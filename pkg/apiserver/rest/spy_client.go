package rest

import (
	"context"

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
	// Reset the counter to zero
	Reset()
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

func (c *spyStorageClient) Reset() {
	c.spy.counts = map[string]int{}
}

type spyStorageShim struct {
	Storage
	spy *StorageSpy
}

type spyLegacyStorageShim struct {
	LegacyStorage
	spy *StorageSpy
}

func (c *spyStorageClient) Create(ctx context.Context, obj runtime.Object, valitation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	c.spy.record("Storage.Create")
	klog.Info("method: Storage.Create")
	return nil, nil
}

// LegacyStorage Spy

type LegacyStorageSpyClient interface {
	LegacyStorage

	//Counts returns the number of times a certain method was called
	Counts(string) int
	// Reset the counter to zero
	Reset()
}

type LegacyStorageSpy struct {
	counts map[string]int
}

type spyLegacyStorageClient struct {
	LegacyStorage
	spy *StorageSpy
}

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

func (c *spyLegacyStorageClient) Reset() {
	c.spy.counts = map[string]int{}
}

func (c *spyLegacyStorageClient) Create(ctx context.Context, obj runtime.Object, valitation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	c.spy.record("LegacyStorage.Create")
	klog.Info("method: Storage.Create")
	return nil, nil
}
