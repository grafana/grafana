package rest

import (
	"context"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

// Unified Storage Spy

type StorageSpyClient interface {
	Storage

	//Counts returns the number of times a certain method was called
	Counts(string) int
}

type StorageSpy struct {
	counts map[string]int
}

type spyStorageClient struct {
	Storage
	spy *StorageSpy
}

func (s *StorageSpy) record(seen string) {
	s.counts[seen]++
}

func NewStorageSpyClient(s Storage) StorageSpyClient {
	return &spyStorageClient{s, &StorageSpy{
		counts: map[string]int{},
	}}
}

func (c *spyStorageClient) Counts(method string) int {
	return c.spy.counts[method]
}

//nolint:golint,unused
type spyStorageShim struct {
	Storage
	spy *StorageSpy
}

//nolint:golint,unused
type spyLegacyStorageShim struct {
	LegacyStorage
	spy *StorageSpy
}

func (c *spyStorageClient) Create(ctx context.Context, obj runtime.Object, valitation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	c.spy.record("Storage.Create")
	klog.Info("method: Storage.Create")
	return nil, nil
}

func (c *spyStorageClient) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	c.spy.record("Storage.Get")
	klog.Info("method: Storage.Get")
	return nil, nil
}

func (c *spyStorageClient) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	c.spy.record("Storage.List")
	klog.Info("method: Storage.List")
	return nil, nil
}

func (c *spyStorageClient) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	c.spy.record("Storage.Update")
	klog.Info("method: Storage.Update")
	return nil, false, nil
}

func (c *spyStorageClient) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	c.spy.record("Storage.Delete")
	klog.Info("method: Storage.Delete")
	return nil, false, nil
}

// LegacyStorage Spy

type LegacyStorageSpyClient interface {
	LegacyStorage

	//Counts returns the number of times a certain method was called
	Counts(string) int
}

type LegacyStorageSpy struct {
	counts map[string]int //nolint:golint,unused
}

type spyLegacyStorageClient struct {
	LegacyStorage
	spy *StorageSpy
}

//nolint:golint,unused
func (s *LegacyStorageSpy) record(seen string) {
	s.counts[seen]++
}

func NewLegacyStorageSpyClient(ls LegacyStorage) LegacyStorageSpyClient {
	return &spyLegacyStorageClient{ls, &StorageSpy{
		counts: map[string]int{},
	}}
}

func (c *spyLegacyStorageClient) Counts(method string) int {
	return c.spy.counts[method]
}

func (c *spyLegacyStorageClient) Create(ctx context.Context, obj runtime.Object, valitation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	c.spy.record("LegacyStorage.Create")
	klog.Info("method: LegacyStorage.Create")
	return nil, nil
}

func (c *spyLegacyStorageClient) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	c.spy.record("LegacyStorage.Get")
	klog.Info("method: LegacyStorage.Get")
	return nil, nil
}

func (c *spyLegacyStorageClient) NewList() runtime.Object {
	// stub for now so that spyLegacyStorageClient implements rest.Lister
	return nil
}

func (c *spyLegacyStorageClient) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	c.spy.record("LegacyStorage.List")
	klog.Info("method: LegacyStorage.List")
	return nil, nil
}

func (c *spyLegacyStorageClient) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	c.spy.record("LegacyStorage.Update")
	klog.Info("method: LegacyStorage.Update")
	return nil, false, nil
}

func (c *spyLegacyStorageClient) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	c.spy.record("LegacyStorage.Delete")
	klog.Info("method: LegacyStorage.Delete")
	return nil, false, nil
}
