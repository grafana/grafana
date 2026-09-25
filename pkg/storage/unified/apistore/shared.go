package apistore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// SharedStorage persists several API groups in a single unified storage collection.
//
// The resource server requires the persisted apiVersion to match the key's group,
// so objects are written with [SharedStorage.Group] and the served group is kept
// in a label. Reads restore the served group and treat objects that carry another
// label value as missing.
type SharedStorage struct {
	// Group used for the storage key, the persisted apiVersion and inline secure value owners
	Group string

	// LabelKey is reserved: writes always overwrite it and reads remove it
	LabelKey string

	// LabelValue identifies the served group within the shared collection.
	// It must be a valid label value, so it is usually shorter than the group itself.
	LabelValue string
}

func (s *SharedStorage) validate() error {
	if s.Group == "" || s.LabelKey == "" || s.LabelValue == "" {
		return fmt.Errorf("group, label key and label value are required")
	}
	return nil
}

// errSharedMismatch reports an object that belongs to another group in the same shared collection.
var errSharedMismatch = errors.New("object belongs to another group in shared storage")

type sharedSerializer struct {
	inner  Serializer
	shared SharedStorage
	served string
}

func (s *sharedSerializer) Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error) {
	// Copy so the caller keeps seeing the served group
	obj = obj.DeepCopyObject()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	labels := meta.GetLabels()
	if labels == nil {
		labels = make(map[string]string, 1)
	}
	labels[s.shared.LabelKey] = s.shared.LabelValue
	meta.SetLabels(labels)

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
	labels := meta.GetLabels()
	if labels[s.shared.LabelKey] != s.shared.LabelValue {
		return nil, errSharedMismatch
	}
	delete(labels, s.shared.LabelKey)
	if len(labels) == 0 {
		labels = nil
	}
	meta.SetLabels(labels)

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
// checks references against the persisted apiVersion, so shared storage owns them
// with the shared group.
func (s *Storage) ownerReference(obj utils.GrafanaMetaAccessor) common.ObjectReference {
	ref := utils.ToObjectReference(obj)
	ref.APIGroup = s.storageGroup()
	return ref
}

// addSharedLabel limits a store list or watch to objects from the served group.
// History and trash requests do not accept label selectors; their results are
// filtered when decoded.
func (s *Storage) addSharedLabel(req *resourcepb.ListRequest) {
	shared := s.opts.SharedStorage
	if shared == nil || req.Source != resourcepb.ListRequest_STORE {
		return
	}
	req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{
		Key:      shared.LabelKey,
		Operator: string(selection.Equals),
		Values:   []string{shared.LabelValue},
	})
}
