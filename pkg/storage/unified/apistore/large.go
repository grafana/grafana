package apistore

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type LargeObjectSupport interface {
	// The size that triggers delegating part of the object to blob storage
	Threshold() int

	// The size where we reject always
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
	ThresholdSize int
	MaxByteSize   int

	// Mutate the spec so it only has the small properties
	ReduceSpec func(obj runtime.Object) error
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
	spec, err := obj.GetSpec()
	if err != nil {
		return err
	}

	// Write only the spec
	val, err := json.Marshal(spec)
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
	return fmt.Errorf("not implemented yet")
}
