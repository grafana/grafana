package apistore

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Called on create
func (s *Storage) prepareObjectForStorage(ctx context.Context, newObject runtime.Object) ([]byte, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(newObject)
	if err != nil {
		return nil, err
	}
	if obj.GetName() == "" {
		return nil, storage.ErrResourceVersionSetOnCreate
	}
	if obj.GetResourceVersion() != "" {
		return nil, storage.ErrResourceVersionSetOnCreate
	}

	obj.SetGenerateName("") // Clear the random name field
	obj.SetResourceVersion("")
	obj.SetSelfLink("")

	// Read+write will verify that origin format is accurate
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, err
	}
	obj.SetOriginInfo(origin)
	obj.SetUpdatedBy("")
	obj.SetUpdatedTimestamp(nil)
	obj.SetCreatedBy(user.GetUID())

	var buf bytes.Buffer
	if err = s.codec.Encode(newObject, &buf); err != nil {
		return nil, err
	}

	if s.largeObjectSupport {
		return s.handleLargeResources(ctx, obj, buf)
	}
	return buf.Bytes(), nil
}

// Called on update
func (s *Storage) prepareObjectForUpdate(ctx context.Context, updateObject runtime.Object, previousObject runtime.Object) ([]byte, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(updateObject)
	if err != nil {
		return nil, err
	}
	if obj.GetName() == "" {
		return nil, fmt.Errorf("updated object must have a name")
	}

	previous, err := utils.MetaAccessor(previousObject)
	if err != nil {
		return nil, err
	}

	if previous.GetUID() == "" {
		klog.Errorf("object is missing UID: %s, %s", obj.GetGroupVersionKind().String(), obj.GetName())
	}

	if obj.GetName() != previous.GetName() {
		return nil, fmt.Errorf("name mismatch between existing and updated object")
	}

	obj.SetUID(previous.GetUID())
	obj.SetCreatedBy(previous.GetCreatedBy())
	obj.SetCreationTimestamp(previous.GetCreationTimestamp())
	obj.SetResourceVersion("")

	// Read+write will verify that origin format is accurate
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, err
	}
	obj.SetOriginInfo(origin)
	obj.SetUpdatedBy(user.GetUID())
	obj.SetUpdatedTimestampMillis(time.Now().UnixMilli())

	var buf bytes.Buffer
	if err = s.codec.Encode(updateObject, &buf); err != nil {
		return nil, err
	}
	if s.largeObjectSupport {
		return s.handleLargeResources(ctx, obj, buf)
	}
	return buf.Bytes(), nil
}

func (s *Storage) handleLargeResources(ctx context.Context, obj utils.GrafanaMetaAccessor, buf bytes.Buffer) ([]byte, error) {
	if buf.Len() > 1000 {
		// !!! Currently just write the whole thing
		// in reality we may only want to write the spec....
		_, err := s.store.PutBlob(ctx, &resource.PutBlobRequest{
			ContentType: "application/json",
			Value:       buf.Bytes(),
			Resource: &resource.ResourceKey{
				Group:     s.gr.Group,
				Resource:  s.gr.Resource,
				Namespace: obj.GetNamespace(),
				Name:      obj.GetName(),
			},
		})
		if err != nil {
			return nil, err
		}
	}
	return buf.Bytes(), nil
}
