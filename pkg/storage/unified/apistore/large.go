package apistore

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type LargeObjectSupport interface {
	// The resource this can process
	GroupResource() schema.GroupResource

	// The size that triggers delegating part of the object to blob storage
	Threshold() int

	// Each resource may have a maximum size that is different than the global maximum
	// for example, we know we will allow dashboards up to 10mb, however most
	// resources should have a smaller limit (1mb?)
	MaxSize() int

	// Deconstruct takes a large object, write most of it to blob storage and leave a few metadata bits around to help with list
	// NOTE: changes to the object must be handled by mutating the input obj
	Deconstruct(ctx context.Context, key *resource.ResourceKey, client resource.BlobStoreClient, obj utils.GrafanaMetaAccessor, raw []byte) error

	// Reconstruct will join the resource+blob back into a complete resource
	// NOTE: changes to the object must be handled by mutating the input obj
	Reconstruct(ctx context.Context, key *resource.ResourceKey, client resource.BlobStoreClient, obj utils.GrafanaMetaAccessor) error
}

var _ LargeObjectSupport = (*BasicLargeObjectSupport)(nil)

type BasicLargeObjectSupport struct {
	TheGroupResource schema.GroupResource
	ThresholdSize    int
	MaxByteSize      int

	// Mutate the spec so it only has the small properties
	ReduceSpec func(obj runtime.Object) error

	// Update the spec so it has the full object
	// This is used to support server-side apply
	RebuildSpec func(obj runtime.Object, blob []byte) error
}

func (s *BasicLargeObjectSupport) GroupResource() schema.GroupResource {
	return s.TheGroupResource
}

// Threshold implements LargeObjectSupport.
func (s *BasicLargeObjectSupport) Threshold() int {
	return s.ThresholdSize
}

// MaxSize implements LargeObjectSupport.
func (s *BasicLargeObjectSupport) MaxSize() int {
	return s.MaxByteSize
}

// Deconstruct implements LargeObjectSupport.
func (s *BasicLargeObjectSupport) Deconstruct(ctx context.Context, key *resource.ResourceKey, client resource.BlobStoreClient, obj utils.GrafanaMetaAccessor, raw []byte) error {
	if key.Group != s.TheGroupResource.Group {
		return fmt.Errorf("requested group mismatch")
	}
	if key.Resource != s.TheGroupResource.Resource {
		return fmt.Errorf("requested resource mismatch")
	}

	spec, err := obj.GetSpec()
	if err != nil {
		return err
	}

	var val []byte

	// :( could not figure out custom JSON marshaling
	// with pointer receiver... this is a quick fix to support dashboards
	u, ok := spec.(common.Unstructured)
	if ok {
		val, err = json.Marshal(u.Object)
	} else {
		val, err = json.Marshal(spec)
	}

	// Write only the spec
	if err != nil {
		return err
	}

	rt, ok := obj.GetRuntimeObject()
	if !ok {
		return fmt.Errorf("expected runtime object")
	}

	err = s.ReduceSpec(rt)
	if err != nil {
		return err
	}

	// Save the blob
	info, err := client.PutBlob(ctx, &resource.PutBlobRequest{
		ContentType: "application/json",
		Value:       val,
		Resource:    key,
	})
	if err != nil {
		return err
	}

	// Update the resource metadata with the blob info
	obj.SetBlob(&utils.BlobInfo{
		UID:      info.Uid,
		Size:     info.Size,
		Hash:     info.Hash,
		MimeType: info.MimeType,
		Charset:  info.Charset,
	})
	return err
}

// Reconstruct implements LargeObjectSupport.
func (s *BasicLargeObjectSupport) Reconstruct(ctx context.Context, key *resource.ResourceKey, client resource.BlobStoreClient, obj utils.GrafanaMetaAccessor) error {
	blobInfo := obj.GetBlob()
	if blobInfo == nil {
		return fmt.Errorf("the object does not have a blob")
	}

	rv, err := obj.GetResourceVersionInt64()
	if err != nil {
		return err
	}
	rsp, err := client.GetBlob(ctx, &resource.GetBlobRequest{
		Resource: &resource.ResourceKey{
			Group:     s.TheGroupResource.Group,
			Resource:  s.TheGroupResource.Resource,
			Namespace: obj.GetNamespace(),
			Name:      obj.GetName(),
		},
		MustProxyBytes:  true,
		ResourceVersion: rv,
	})
	if err != nil {
		return err
	}
	if rsp.Error != nil {
		return fmt.Errorf("error loading value from object store %+v", rsp.Error)
	}

	// Replace the spec with the value saved in the blob store
	if len(rsp.Value) == 0 {
		return fmt.Errorf("empty blob value")
	}

	rt, ok := obj.GetRuntimeObject()
	if !ok {
		return fmt.Errorf("unable to get raw object")
	}
	obj.SetBlob(nil) // remove the blob info
	return s.RebuildSpec(rt, rsp.Value)
}
