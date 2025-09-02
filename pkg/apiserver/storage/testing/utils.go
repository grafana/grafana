// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/apiserver/blob/master/pkg/storage/testing/utils.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package testing

import (
	"bytes"
	"context"
	"fmt"
	"path"
	"reflect"
	"runtime/debug"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"k8s.io/apimachinery/pkg/api/meta"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/apis/example"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/value"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
)

var NewContext = func() context.Context {
	return context.Background()
}

// KeyFunc is a function that generates keys for tests.
// All tests use the "pods" resource, so the resource is hardcoded to "pods".
var KeyFunc = func(namespace, name string) string {
	k := grafanaregistry.Key{
		Resource:  "pods",
		Namespace: namespace,
		Name:      name,
	}
	return k.String()
}

// CreateObjList will create a list from the array of objects.
func CreateObjList(prefix string, helper storage.Interface, items []runtime.Object) error {
	for i := range items {
		obj := items[i]
		meta, err := meta.Accessor(obj)
		if err != nil {
			return err
		}
		err = helper.Create(context.Background(), path.Join(prefix, meta.GetName()), obj, obj, 0)
		if err != nil {
			return err
		}
		items[i] = obj
	}
	return nil
}

// CreateList will properly create a list using the storage interface.
func CreateList(prefix string, helper storage.Interface, list runtime.Object) error {
	items, err := meta.ExtractList(list)
	if err != nil {
		return err
	}
	err = CreateObjList(prefix, helper, items)
	if err != nil {
		return err
	}
	return meta.SetList(list, items)
}

// DeepEqualSafePodSpec returns an example.PodSpec safe for deep-equal operations.
func DeepEqualSafePodSpec() example.PodSpec {
	grace := int64(30)
	return example.PodSpec{
		RestartPolicy:                 "Always",
		TerminationGracePeriodSeconds: &grace,
		SchedulerName:                 "default-scheduler",
	}
}

func computePodKey(obj *example.Pod) string {
	return KeyFunc(obj.Namespace, obj.Name)
}

// testPropagateStore helps propagates store with objects, automates key generation, and returns
// keys and stored objects.
func testPropagateStore(ctx context.Context, t *testing.T, store storage.Interface, obj *example.Pod) (string, *example.Pod) {
	// Setup store with a key and grab the output for returning.
	key := computePodKey(obj)

	// Setup store with the specified key and grab the output for returning.
	err := store.Delete(ctx, key, &example.Pod{}, nil, storage.ValidateAllObjectFunc, nil, storage.DeleteOptions{})
	if err != nil && !storage.IsNotFound(err) {
		t.Fatalf("Cleanup failed: %v", err)
	}
	setOutput := &example.Pod{}
	if err := store.Create(ctx, key, obj, setOutput, 0); err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	return key, setOutput
}

func expectNoDiff(t *testing.T, msg string, expected, actual interface{}) {
	t.Helper()
	if !reflect.DeepEqual(expected, actual) {
		if diff := cmp.Diff(expected, actual); diff != "" {
			debug.PrintStack()
			t.Errorf("%s: %s", msg, diff)
		} else {
			t.Errorf("%s:\nexpected: %#v\ngot: %#v", msg, expected, actual)
		}
	}
}

func ExpectContains(t *testing.T, msg string, expectedList []interface{}, got interface{}) {
	t.Helper()
	for _, expected := range expectedList {
		if reflect.DeepEqual(expected, got) {
			return
		}
	}
	if len(expectedList) == 0 {
		t.Errorf("%s: empty expectedList", msg)
		return
	}
	if diff := cmp.Diff(expectedList[0], got); diff != "" {
		t.Errorf("%s: differs from all items, with first: %s", msg, diff)
	} else {
		t.Errorf("%s: differs from all items, first: %#v\ngot: %#v", msg, expectedList[0], got)
	}
}

const dummyPrefix = "adapter"

func encodeContinueOrDie(key string, resourceVersion int64) string {
	token, err := storage.EncodeContinue(dummyPrefix+key, dummyPrefix, resourceVersion)
	if err != nil {
		panic(err)
	}
	return token
}

func testCheckEventType(t *testing.T, w watch.Interface, expectEventType watch.EventType) {
	select {
	case res := <-w.ResultChan():
		if res.Type != expectEventType {
			t.Errorf("event type want=%v, get=%v", expectEventType, res.Type)
		}
	case <-time.After(wait.ForeverTestTimeout):
		t.Errorf("time out after waiting %v on ResultChan", wait.ForeverTestTimeout)
	}
}

func testCheckResult(t *testing.T, w watch.Interface, expectEvent watch.Event) {
	testCheckResultFunc(t, w, func(actualEvent watch.Event) {
		expectNoDiff(t, "incorrect event", expectEvent, actualEvent)
	})
}

func testCheckResultFunc(t *testing.T, w watch.Interface, check func(actualEvent watch.Event)) {
	select {
	case res := <-w.ResultChan():
		obj := res.Object
		if co, ok := obj.(runtime.CacheableObject); ok {
			res.Object = co.GetObject()
		}
		check(res)
	case <-time.After(wait.ForeverTestTimeout):
		t.Errorf("time out after waiting %v on ResultChan", wait.ForeverTestTimeout)
	}
}

func testCheckStop(t *testing.T, w watch.Interface) {
	select {
	case e, ok := <-w.ResultChan():
		if ok {
			var obj string
			switch e.Object.(type) {
			case *example.Pod:
				obj = e.Object.(*example.Pod).Name
			case *v1.Status:
				obj = e.Object.(*v1.Status).Message
			}
			t.Errorf("ResultChan should have been closed. Event: %s. Object: %s", e.Type, obj)
		}
	case <-time.After(wait.ForeverTestTimeout):
		t.Errorf("time out after waiting 1s on ResultChan")
	}
}

func testCheckResultsInStrictOrder(t *testing.T, w watch.Interface, expectedEvents []watch.Event) {
	fmt.Printf("expectedEvents: %+v\n", expectedEvents)
	for i, expectedEvent := range expectedEvents {
		fmt.Printf("expectedEvent[%d]: [%+v] %+v\n", i, expectedEvent.Type, expectedEvent.Object)
		testCheckResult(t, w, expectedEvent)
	}
}

func testCheckResultsInRandomOrder(t *testing.T, w watch.Interface, expectedEvents []watch.Event) {
	for range expectedEvents {
		testCheckResultFunc(t, w, func(actualEvent watch.Event) {
			ExpectContains(t, "unexpected event", toInterfaceSlice(expectedEvents), actualEvent)
		})
	}
}

func testCheckNoMoreResults(t *testing.T, w watch.Interface) {
	select {
	case e := <-w.ResultChan():
		t.Errorf("Unexpected: %#v event received, expected no events", e)
	case <-time.After(time.Second):
		return
	}
}

func toInterfaceSlice[T any](s []T) []interface{} {
	result := make([]interface{}, len(s))
	for i, v := range s {
		result[i] = v
	}
	return result
}

// resourceVersionNotOlderThan returns a function to validate resource versions. Resource versions
// referring to points in logical time before the sentinel generate an error. All logical times as
// new as the sentinel or newer generate no error.
func resourceVersionNotOlderThan(sentinel string) func(string) error {
	return func(resourceVersion string) error {
		objectVersioner := storage.APIObjectVersioner{}
		actualRV, err := objectVersioner.ParseResourceVersion(resourceVersion)
		if err != nil {
			return err
		}
		expectedRV, err := objectVersioner.ParseResourceVersion(sentinel)
		if err != nil {
			return err
		}
		if actualRV < expectedRV {
			return fmt.Errorf("expected a resourceVersion no smaller than than %d, but got %d", expectedRV, actualRV)
		}
		return nil
	}
}

// StorageInjectingListErrors injects a dummy error for first N GetList calls.
type StorageInjectingListErrors struct {
	storage.Interface

	lock   sync.Mutex
	Errors int
}

func (s *StorageInjectingListErrors) GetList(ctx context.Context, key string, opts storage.ListOptions, listObj runtime.Object) error {
	err := func() error {
		s.lock.Lock()
		defer s.lock.Unlock()
		if s.Errors > 0 {
			s.Errors--
			return fmt.Errorf("injected error")
		}
		return nil
	}()
	if err != nil {
		return err
	}
	return s.Interface.GetList(ctx, key, opts, listObj)
}

func (s *StorageInjectingListErrors) ErrorsConsumed() (bool, error) {
	s.lock.Lock()
	defer s.lock.Unlock()
	return s.Errors == 0, nil
}

type Compaction func(ctx context.Context, t *testing.T, resourceVersion string)

type PrefixTransformerModifier func(*PrefixTransformer) value.Transformer

type InterfaceWithPrefixTransformer interface {
	storage.Interface

	UpdatePrefixTransformer(PrefixTransformerModifier) func()
}

// PrefixTransformer adds and verifies that all data has the correct prefix on its way in and out.
type PrefixTransformer struct {
	prefix []byte
	stale  bool
	err    error
	reads  uint64
}

func NewPrefixTransformer(prefix []byte, stale bool) *PrefixTransformer {
	return &PrefixTransformer{
		prefix: prefix,
		stale:  stale,
	}
}

func (p *PrefixTransformer) TransformFromStorage(ctx context.Context, data []byte, dataCtx value.Context) ([]byte, bool, error) {
	atomic.AddUint64(&p.reads, 1)
	if dataCtx == nil {
		panic("no context provided")
	}
	if !bytes.HasPrefix(data, p.prefix) {
		return nil, false, fmt.Errorf("value does not have expected prefix %q: %s,", p.prefix, string(data))
	}
	return bytes.TrimPrefix(data, p.prefix), p.stale, p.err
}
func (p *PrefixTransformer) TransformToStorage(ctx context.Context, data []byte, dataCtx value.Context) ([]byte, error) {
	if dataCtx == nil {
		panic("no context provided")
	}
	if len(data) > 0 {
		return append(append([]byte{}, p.prefix...), data...), p.err
	}
	return data, p.err
}

func (p *PrefixTransformer) GetReadsAndReset() uint64 {
	return atomic.SwapUint64(&p.reads, 0)
}

// reproducingTransformer is a custom test-only transformer used purely
// for testing consistency.
// It allows for creating predefined objects on TransformFromStorage operations,
// which allows for precise in time injection of new objects in the middle of
// read operations.
type reproducingTransformer struct {
	wrapped value.Transformer
	store   storage.Interface

	index      uint32
	nextObject func(uint32) (string, *example.Pod)
}

func (rt *reproducingTransformer) TransformFromStorage(ctx context.Context, data []byte, dataCtx value.Context) ([]byte, bool, error) {
	if err := rt.createObject(ctx); err != nil {
		return nil, false, err
	}
	return rt.wrapped.TransformFromStorage(ctx, data, dataCtx)
}

func (rt *reproducingTransformer) TransformToStorage(ctx context.Context, data []byte, dataCtx value.Context) ([]byte, error) {
	return rt.wrapped.TransformToStorage(ctx, data, dataCtx)
}

func (rt *reproducingTransformer) createObject(ctx context.Context) error {
	key, obj := rt.nextObject(atomic.AddUint32(&rt.index, 1))
	out := &example.Pod{}
	return rt.store.Create(ctx, key, obj, out, 0)
}

// failingTransformer is a custom test-only transformer that always returns
// an error on transforming data from storage.
type failingTransformer struct {
}

func (ft *failingTransformer) TransformFromStorage(ctx context.Context, data []byte, dataCtx value.Context) ([]byte, bool, error) {
	return nil, false, fmt.Errorf("failed transformation")
}

func (ft *failingTransformer) TransformToStorage(ctx context.Context, data []byte, dataCtx value.Context) ([]byte, error) {
	return data, nil
}

type sortablePodList []example.Pod

func (s sortablePodList) Len() int {
	return len(s)
}

func (s sortablePodList) Less(i, j int) bool {
	return computePodKey(&s[i]) < computePodKey(&s[j])
}

func (s sortablePodList) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}
