package apistore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// SharedStorage persists several API groups in a single unified storage collection.
//
// The resource server requires the persisted apiVersion to match the key's group,
// so objects are written with [SharedStorage.Group] and restored to the served
// group on read. Each served group is told apart from the others in the
// collection by a label, by a fixed name, or both; objects that belong to
// another served group are treated as missing.
type SharedStorage struct {
	// Group used for the storage key, the persisted apiVersion and inline secure value owners
	Group string

	// LabelKey is reserved: writes always overwrite it and reads remove it.
	// Required unless Name is set.
	LabelKey string

	// LabelValue identifies the served group within the shared collection.
	// It must be a valid label value, so it is usually shorter than the group itself.
	LabelValue string

	// Name limits the served resource to a single object that is stored under
	// another name, for example each app plugin's "instance" settings are
	// stored under the plugin ID.
	Name *SharedName
}

// SharedName maps the only name a served group accepts onto its name in the shared collection
type SharedName struct {
	Served string
	Stored string
}

func (s *SharedStorage) validate() error {
	if s.Group == "" {
		return fmt.Errorf("group is required")
	}
	if (s.LabelKey == "") != (s.LabelValue == "") {
		return fmt.Errorf("label key and value must be set together")
	}
	if s.Name != nil && (s.Name.Served == "" || s.Name.Stored == "") {
		return fmt.Errorf("served and stored names are required")
	}
	if s.LabelKey == "" && s.Name == nil {
		return fmt.Errorf("a label or a name is required to separate groups")
	}
	return nil
}

func (s *SharedStorage) hasLabel() bool {
	return s.LabelKey != ""
}

// storedName maps a name from the served API into the shared collection
func (s *SharedStorage) storedName(name string) (string, error) {
	if s.Name == nil || name == "" {
		return name, nil
	}
	if name != s.Name.Served {
		return "", apierrors.NewBadRequest(fmt.Sprintf("name must be %q", s.Name.Served))
	}
	return s.Name.Stored, nil
}

// errSharedMismatch reports an object that belongs to another group in the same shared collection.
var errSharedMismatch = errors.New("object belongs to another group in shared storage")

type sharedSerializer struct {
	inner  Serializer
	shared SharedStorage
	served string
}

func (s *sharedSerializer) Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error) {
	// Copy so the caller keeps seeing the served group and name
	obj = obj.DeepCopyObject()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	if s.shared.hasLabel() {
		labels := meta.GetLabels()
		if labels == nil {
			labels = make(map[string]string, 1)
		}
		labels[s.shared.LabelKey] = s.shared.LabelValue
		meta.SetLabels(labels)
	}
	name, err := s.shared.storedName(meta.GetName())
	if err != nil {
		return nil, err
	}
	meta.SetName(name)

	gvk := obj.GetObjectKind().GroupVersionKind()
	gvk.Group = s.shared.Group
	obj.GetObjectKind().SetGroupVersionKind(gvk)
	return s.inner.Encode(ctx, obj)
}

func (s *sharedSerializer) Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error) {
	obj, err := s.inner.Decode(ctx, data, into)
	if err != nil {
		return obj, err
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	if s.shared.Name != nil {
		if meta.GetName() != s.shared.Name.Stored {
			return nil, errSharedMismatch
		}
		meta.SetName(s.shared.Name.Served)
	}
	if s.shared.hasLabel() {
		labels := meta.GetLabels()
		if labels[s.shared.LabelKey] != s.shared.LabelValue {
			return nil, errSharedMismatch
		}
		delete(labels, s.shared.LabelKey)
		if len(labels) == 0 {
			labels = nil
		}
		meta.SetLabels(labels)
	}

	gvk := obj.GetObjectKind().GroupVersionKind()
	gvk.Group = s.served
	obj.GetObjectKind().SetGroupVersionKind(gvk)
	return obj, nil
}

// storageGroup is the group persisted in keys and in the stored apiVersion
func (s *Storage) storageGroup() string {
	if s.opts.SharedStorage != nil {
		return s.opts.SharedStorage.Group
	}
	return s.gr.Group
}

// ownerReference identifies the owner of inline secure values. The resource server
// checks references against the persisted object, so shared storage owns them
// with the shared group and stored name.
func (s *Storage) ownerReference(obj utils.GrafanaMetaAccessor) common.ObjectReference {
	ref := utils.ToObjectReference(obj)
	if shared := s.opts.SharedStorage; shared != nil {
		ref.APIGroup = shared.Group
		// The key has already rejected any other name
		if shared.Name != nil && ref.Name == shared.Name.Served {
			ref.Name = shared.Name.Stored
		}
	}
	return ref
}

// restrictSharedList limits a list or watch to objects from the served group.
// History and trash requests do not accept selectors; their results are
// filtered when decoded.
func (s *Storage) restrictSharedList(req *resourcepb.ListRequest) error {
	shared := s.opts.SharedStorage
	if shared == nil {
		return nil
	}
	// History requests carry the served name from the field selector
	name, err := shared.storedName(req.Options.Key.Name)
	if err != nil {
		return err
	}
	req.Options.Key.Name = name

	if req.Source != resourcepb.ListRequest_STORE {
		return nil
	}
	if shared.hasLabel() {
		req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{
			Key:      shared.LabelKey,
			Operator: string(selection.Equals),
			Values:   []string{shared.LabelValue},
		})
	}
	if shared.Name != nil {
		for _, field := range req.Options.Fields {
			if field.Key != "metadata.name" {
				continue
			}
			for i, v := range field.Values {
				if v == shared.Name.Served {
					field.Values[i] = shared.Name.Stored
				}
			}
		}
		// The server answers a name selector with a single read
		req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
			Key:      "metadata.name",
			Operator: string(selection.Equals),
			Values:   []string{shared.Name.Stored},
		})
	}
	return nil
}
