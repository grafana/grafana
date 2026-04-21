package dualwrite

import (
	"context"
	"errors"
	"sync"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/setting"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

// mutableStatusReader is a test helper that allows changing the storage mode at
// runtime, simulating a migration completing after the dualWriter was created.
type mutableStatusReader struct {
	mu   sync.Mutex
	mode unifiedmigrations.StorageMode
}

func (r *mutableStatusReader) GetStorageMode(_ context.Context, _ schema.GroupResource) (unifiedmigrations.StorageMode, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.mode, nil
}

func (r *mutableStatusReader) setMode(m unifiedmigrations.StorageMode) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.mode = m
}

func newStorage(gr schema.GroupResource, mode grafanarest.DualWriterMode, legacy grafanarest.Storage, unified grafanarest.Storage) (grafanarest.Storage, error) {
	cfg := NewFakeConfig()
	cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{DualWriterMode: mode}
	return ProvideServiceForTests(cfg).NewStorage(gr, legacy, unified)
}

// returnVal holds a single return value set for a fakeStorage method.
type returnVal struct {
	obj  runtime.Object
	obj2 bool // second return for Delete/Update
	err  error
}

// callRecord holds the arguments from a single method call.
type callRecord struct {
	args []any
}

// fakeStorage is a hand-written test fake implementing grafanarest.Storage methods.
// Tests configure it by appending to the *Returns slices. Each method pops the first
// element from its return queue; if only one element remains it is reused for all
// subsequent calls (matching the behavior of mock.Return without .Once).
type fakeStorage struct {
	grafanarest.Storage // embedded for unimplemented methods

	mu sync.Mutex

	createReturns []returnVal
	createCalls   []callRecord

	getReturns []returnVal
	getCalls   []callRecord
	blockGet   bool // if true, Get blocks until ctx is canceled

	listReturns []returnVal
	listCalls   []callRecord
	blockList   bool // if true, List blocks until ctx is canceled

	updateReturns []returnVal
	updateCalls   []callRecord

	deleteReturns []returnVal
	deleteCalls   []callRecord

	deleteCollectionReturns []returnVal
	deleteCollectionCalls   []callRecord
}

// Helper methods to configure return values. Each pushes onto the method's return queue.
func (f *fakeStorage) onCreate(obj runtime.Object, err error) {
	f.createReturns = append(f.createReturns, returnVal{obj: obj, err: err})
}
func (f *fakeStorage) onGet(obj runtime.Object, err error) {
	f.getReturns = append(f.getReturns, returnVal{obj: obj, err: err})
}
func (f *fakeStorage) onList(obj runtime.Object, err error) {
	f.listReturns = append(f.listReturns, returnVal{obj: obj, err: err})
}
func (f *fakeStorage) onUpdate(obj runtime.Object, err error) {
	f.updateReturns = append(f.updateReturns, returnVal{obj: obj, err: err})
}
func (f *fakeStorage) onDelete(obj runtime.Object, err error) {
	f.deleteReturns = append(f.deleteReturns, returnVal{obj: obj, err: err})
}
func (f *fakeStorage) onDeleteCollection(obj runtime.Object, err error) {
	f.deleteCollectionReturns = append(f.deleteCollectionReturns, returnVal{obj: obj, err: err})
}

// pop removes and returns the first element of the slice if there are more than one;
// otherwise it returns the single remaining element (keeping it for future calls).
// It panics if the slice is empty, which signals a test misconfiguration.
func pop(returns *[]returnVal) returnVal {
	if len(*returns) == 0 {
		panic("fakeStorage: no return values configured")
	}
	v := (*returns)[0]
	if len(*returns) > 1 {
		*returns = (*returns)[1:]
	}
	return v
}

func (f *fakeStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	if f.blockGet {
		<-ctx.Done()
		return nil, errors.New("context canceled")
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.getCalls = append(f.getCalls, callRecord{args: []any{ctx, name, options}})
	r := pop(&f.getReturns)
	if r.err != nil {
		return nil, r.err
	}
	return r.obj, nil
}

func (f *fakeStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.createCalls = append(f.createCalls, callRecord{args: []any{ctx, obj, createValidation, options}})
	r := pop(&f.createReturns)
	if r.err != nil {
		return nil, r.err
	}
	return r.obj, nil
}

func (f *fakeStorage) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	if f.blockList {
		<-ctx.Done()
		return nil, errors.New("context canceled")
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.listCalls = append(f.listCalls, callRecord{args: []any{ctx, options}})
	r := pop(&f.listReturns)
	if r.err != nil {
		return nil, r.err
	}
	return r.obj, nil
}

func (f *fakeStorage) NewList() runtime.Object {
	return nil
}

func (f *fakeStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	select {
	case <-ctx.Done():
		return nil, false, errors.New("context canceled")
	default:
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.updateCalls = append(f.updateCalls, callRecord{args: []any{ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options}})
	r := pop(&f.updateReturns)
	if r.err != nil {
		return nil, false, r.err
	}
	return r.obj, r.obj2, nil
}

func (f *fakeStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	select {
	case <-ctx.Done():
		return nil, false, errors.New("context canceled")
	default:
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleteCalls = append(f.deleteCalls, callRecord{args: []any{ctx, name, deleteValidation, options}})
	r := pop(&f.deleteReturns)
	if r.err != nil {
		return nil, false, r.err
	}
	return r.obj, r.obj2, nil
}

func (f *fakeStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *metainternalversion.ListOptions) (runtime.Object, error) {
	select {
	case <-ctx.Done():
		return nil, errors.New("context canceled")
	default:
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.deleteCollectionCalls = append(f.deleteCollectionCalls, callRecord{args: []any{ctx, deleteValidation, options, listOptions}})
	r := pop(&f.deleteCollectionReturns)
	if r.err != nil {
		return nil, r.err
	}
	return r.obj, nil
}

type updatedObjInfoObj struct{}

func (u updatedObjInfoObj) UpdatedObject(ctx context.Context, oldObj runtime.Object) (newObj runtime.Object, err error) { // nolint:staticcheck
	// nolint:staticcheck
	oldObj = exampleObj
	return oldObj, nil
}
func (u updatedObjInfoObj) Preconditions() *metav1.Preconditions { return &metav1.Preconditions{} }
