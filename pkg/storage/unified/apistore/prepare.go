package apistore

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/storage"

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
		return nil, fmt.Errorf("new object must have a name")
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
	err = s.codec.Encode(newObject, &buf)
	if err != nil {
		return nil, err
	}
	return s.handleLargeResources(ctx, obj, buf)
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
	obj.SetUID(previous.GetUID())
	obj.SetCreatedBy(previous.GetCreatedBy())
	obj.SetCreationTimestamp(previous.GetCreationTimestamp())

	// Read+write will verify that origin format is accurate
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, err
	}
	obj.SetOriginInfo(origin)
	obj.SetUpdatedBy(user.GetUID())
	obj.SetUpdatedTimestampMillis(time.Now().UnixMilli())

	var buf bytes.Buffer
	err = s.codec.Encode(updateObject, &buf)
	if err != nil {
		return nil, err
	}
	return s.handleLargeResources(ctx, obj, buf)
}

func (s *Storage) handleLargeResources(ctx context.Context, obj utils.GrafanaMetaAccessor, buf bytes.Buffer) ([]byte, error) {
	if buf.Len() > 1000 {
		// !!! Currently just write the whole thing
		// in reality we may only want to write the spec....
		rsp, err := s.store.PutBlob(ctx, &resource.PutBlobRequest{
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
		fmt.Printf("WROTE: %+v\n", rsp)
	}
	return buf.Bytes(), nil
}
