package checkscheduler

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestRunner_MT_DiscoveryTwoNamespaces(t *testing.T) {
	var createdNS []string
	var mu sync.Mutex

	old := metav1.NewTime(time.Now().Add(-15 * 24 * time.Hour))
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			if namespace == "" {
				return &advisorv0alpha1.CheckList{
					Items: []advisorv0alpha1.Check{
						{
							ObjectMeta: metav1.ObjectMeta{
								Namespace:         "stacks-1",
								Name:              "c1",
								CreationTimestamp: old,
								Labels:            map[string]string{checks.TypeLabel: "test-check"},
								Annotations:       map[string]string{checks.StatusAnnotation: checks.StatusAnnotationProcessed},
							},
						},
						{
							ObjectMeta: metav1.ObjectMeta{
								Namespace:         "stacks-2",
								Name:              "c2",
								CreationTimestamp: old,
								Labels:            map[string]string{checks.TypeLabel: "test-check"},
								Annotations:       map[string]string{checks.StatusAnnotation: checks.StatusAnnotationProcessed},
							},
						},
					},
				}, nil
			}
			return &advisorv0alpha1.CheckList{
				Items: []advisorv0alpha1.Check{
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:         namespace,
							Name:              "c1",
							CreationTimestamp: old,
							Labels:            map[string]string{checks.TypeLabel: "test-check"},
							Annotations:       map[string]string{checks.StatusAnnotation: checks.StatusAnnotationProcessed},
						},
					},
				},
			}, nil
		},
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			mu.Lock()
			createdNS = append(createdNS, obj.GetNamespace())
			mu.Unlock()
			return obj, nil
		},
	}
	mockTypes := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckTypeList{
				Items: []advisorv0alpha1.CheckType{
					{
						ObjectMeta: metav1.ObjectMeta{Name: "test-check"},
						Spec:       advisorv0alpha1.CheckTypeSpec{Name: "test-check"},
					},
				},
			}, nil
		},
	}
	reg := &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}}
	runner := createTestMTRunner(mockClient, mockTypes, reg)

	err := runAndTimeout(runner)
	assert.ErrorIs(t, err, context.DeadlineExceeded)
	mu.Lock()
	defer mu.Unlock()
	assert.Contains(t, createdNS, "stacks-1")
	assert.Contains(t, createdNS, "stacks-2")
}

func TestDiscoverNamespaces_Pagination(t *testing.T) {
	var listCalls atomic.Int32
	old := metav1.NewTime(time.Now().Add(-15 * 24 * time.Hour))

	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			assert.Equal(t, resource.NamespaceAll, namespace)
			n := listCalls.Add(1)
			if n == 1 {
				assert.Equal(t, "", options.Continue, "first cluster list should have empty continue")
				return &advisorv0alpha1.CheckList{
					ListMeta: metav1.ListMeta{Continue: "page-2"},
					Items: []advisorv0alpha1.Check{
						{
							ObjectMeta: metav1.ObjectMeta{
								Namespace:         "stacks-1",
								Name:              "a",
								CreationTimestamp: old,
								Labels:            map[string]string{checks.TypeLabel: "x"},
							},
						},
					},
				}, nil
			}
			assert.Equal(t, "page-2", options.Continue, "second cluster list must pass continue token")
			return &advisorv0alpha1.CheckList{
				Items: []advisorv0alpha1.Check{
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:         "stacks-2",
							Name:              "b",
							CreationTimestamp: old,
							Labels:            map[string]string{checks.TypeLabel: "x"},
						},
					},
				},
			}, nil
		},
	}
	r := &Runner{
		checksMetadata: metadataGetterFromClient(mockClient),
		log:            &logging.NoOpLogger{},
	}
	ns, last, err := r.discoverNamespaces(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
	assert.Equal(t, []string{"stacks-1", "stacks-2"}, ns)
	assert.Len(t, last, 2)
	assert.Equal(t, int32(2), listCalls.Load())
}

func TestDiscoverNamespaces_IgnoresNonStacksNamespaces(t *testing.T) {
	old := metav1.NewTime(time.Now().Add(-15 * 24 * time.Hour))
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckList{
				Items: []advisorv0alpha1.Check{
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:         "stacks-42",
							Name:              "a",
							CreationTimestamp: old,
						},
					},
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:         "default",
							Name:              "b",
							CreationTimestamp: old,
						},
					},
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:         "grafana",
							Name:              "c",
							CreationTimestamp: old,
						},
					},
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:         "stacks-not-a-number",
							Name:              "d",
							CreationTimestamp: old,
						},
					},
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace:         "org-2",
							Name:              "e",
							CreationTimestamp: old,
						},
					},
				},
			}, nil
		},
	}
	r := &Runner{
		checksMetadata: metadataGetterFromClient(mockClient),
		log:            &logging.NoOpLogger{},
	}
	ns, last, err := r.discoverNamespaces(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
	assert.Equal(t, []string{"stacks-42"}, ns)
	assert.Len(t, last, 1)
	assert.Equal(t, old.Time, last["stacks-42"])
}

func TestRunner_MT_ErrorIsolation(t *testing.T) {
	old := metav1.NewTime(time.Now().Add(-15 * 24 * time.Hour))
	var mu sync.Mutex
	var created []string

	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			if namespace == "" {
				return &advisorv0alpha1.CheckList{
					Items: []advisorv0alpha1.Check{
						{
							ObjectMeta: metav1.ObjectMeta{
								Namespace: "stacks-1", Name: "a", CreationTimestamp: old,
								Labels:      map[string]string{checks.TypeLabel: "test-check"},
								Annotations: map[string]string{checks.StatusAnnotation: checks.StatusAnnotationProcessed},
							},
						},
						{
							ObjectMeta: metav1.ObjectMeta{
								Namespace: "stacks-2", Name: "b", CreationTimestamp: old,
								Labels:      map[string]string{checks.TypeLabel: "test-check"},
								Annotations: map[string]string{checks.StatusAnnotation: checks.StatusAnnotationProcessed},
							},
						},
					},
				}, nil
			}
			return &advisorv0alpha1.CheckList{
				Items: []advisorv0alpha1.Check{
					{
						ObjectMeta: metav1.ObjectMeta{
							Namespace: namespace, Name: "c", CreationTimestamp: old,
							Labels:      map[string]string{checks.TypeLabel: "test-check"},
							Annotations: map[string]string{checks.StatusAnnotation: checks.StatusAnnotationProcessed},
						},
					},
				},
			}, nil
		},
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			ns := obj.GetNamespace()
			if ns == "stacks-2" {
				return nil, errors.New("simulated create failure")
			}
			mu.Lock()
			created = append(created, ns)
			mu.Unlock()
			return obj, nil
		},
	}
	mockTypes := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckTypeList{
				Items: []advisorv0alpha1.CheckType{
					{ObjectMeta: metav1.ObjectMeta{Name: "test-check"}, Spec: advisorv0alpha1.CheckTypeSpec{Name: "test-check"}},
				},
			}, nil
		},
	}
	reg := &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}}
	runner := createTestMTRunner(mockClient, mockTypes, reg)
	err := runAndTimeout(runner)
	assert.ErrorIs(t, err, context.DeadlineExceeded)
	mu.Lock()
	defer mu.Unlock()
	assert.Contains(t, created, "stacks-1")
	assert.NotContains(t, created, "stacks-2")
}

// TestRunTickParallelMT_TicksAllStaleNamespaces exercises the parallel tick
// fan-out with many namespaces and a low concurrency cap so that worker
// goroutines run simultaneously (with -race, this also guards against
// concurrent access to the shared maps). Every namespace starts stale, so we
// assert that createChecks ran for each one — the observable effect of a tick,
// rather than a mutation of the caller's read-only timestamps map.
func TestRunTickParallelMT_TicksAllStaleNamespaces(t *testing.T) {
	const namespaceCount = 200
	stale := time.Now().Add(-30 * 24 * time.Hour)

	var mu sync.Mutex
	created := make(map[string]bool, namespaceCount)
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckList{Items: []advisorv0alpha1.Check{}}, nil
		},
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			mu.Lock()
			created[obj.GetNamespace()] = true
			mu.Unlock()
			return obj, nil
		},
		deleteFunc: func(ctx context.Context, id resource.Identifier, opts resource.DeleteOptions) error {
			return nil
		},
	}
	mockTypes := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckTypeList{Items: []advisorv0alpha1.CheckType{}}, nil
		},
	}
	reg := &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}}
	runner := createTestMTRunnerWithConcurrency(mockClient, mockTypes, reg)

	namespaces := make([]string, 0, namespaceCount)
	lastCreated := make(map[string]time.Time, namespaceCount)
	for i := 0; i < namespaceCount; i++ {
		ns := fmt.Sprintf("stacks-%d", i)
		namespaces = append(namespaces, ns)
		lastCreated[ns] = stale
	}

	runner.runTickParallelMT(context.Background(), &logging.NoOpLogger{}, namespaces, lastCreated)

	mu.Lock()
	defer mu.Unlock()
	for _, ns := range namespaces {
		assert.True(t, created[ns], "expected createChecks to run for %s", ns)
	}
}

// TestRunner_MT_InitialDiscoveryFailure verifies that a failure on the
// boot-time cluster-wide Check list tears down the runner with the underlying
// error wrapped, so the app-sdk runtime can surface it rather than letting the
// scheduler silently keep running with no namespaces.
func TestRunner_MT_InitialDiscoveryFailure(t *testing.T) {
	bootErr := errors.New("boom")
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return nil, bootErr
		},
	}
	mockTypes := &MockClient{}
	runner := createTestMTRunner(mockClient, mockTypes, &MockCheckService{checks: []checks.Check{}})

	err := runAndTimeout(runner)
	assert.ErrorIs(t, err, bootErr)
	assert.NotErrorIs(t, err, context.DeadlineExceeded)
}

// TestTickNamespace_SkipsWhenNotStale verifies that tickNamespace does no work
// (no Create call) when the namespace's last check is newer than the
// evaluation interval, and returns the input lastCreated unchanged so the
// caller does not overwrite it.
func TestTickNamespace_SkipsWhenNotStale(t *testing.T) {
	var createCalled atomic.Bool
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckList{Items: []advisorv0alpha1.Check{}}, nil
		},
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			createCalled.Store(true)
			return obj, nil
		},
	}
	r := &Runner{
		checksClient:        mockClient,
		defaultEvalInterval: 1 * time.Hour,
		log:                 &logging.NoOpLogger{},
	}
	recent := time.Now().Add(-1 * time.Minute)
	newLast, err := r.tickNamespace(context.Background(), &logging.NoOpLogger{}, "stacks-1", recent)
	assert.NoError(t, err)
	assert.Equal(t, recent, newLast)
	assert.False(t, createCalled.Load(), "tickNamespace must not create checks when not stale")
}

// TestTickNamespace_SyncsCheckTypesBeforeCreatingChecks verifies that a stale
// namespace gets its CheckTypes synced with the in-process registry before any
// Check is created. In MT, CheckType registration is otherwise on-demand (the
// "register" endpoint), so without this ordering a tick could create Checks
// for types whose CheckType resource doesn't exist yet in the namespace.
func TestTickNamespace_SyncsCheckTypesBeforeCreatingChecks(t *testing.T) {
	var order []string
	var mu sync.Mutex
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckList{Items: []advisorv0alpha1.Check{}}, nil
		},
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			mu.Lock()
			order = append(order, "create")
			mu.Unlock()
			return obj, nil
		},
	}
	r := &Runner{
		checkRegistry: &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}},
		checksClient:  mockClient,
		checkTypeSyncer: &mockCheckTypeSyncer{
			syncFunc: func(ctx context.Context, logger logging.Logger, namespace string) error {
				mu.Lock()
				order = append(order, "sync:"+namespace)
				mu.Unlock()
				return nil
			},
		},
		defaultEvalInterval: 1 * time.Hour,
		maxHistory:          defaultMaxHistory,
		log:                 &logging.NoOpLogger{},
	}
	stale := time.Now().Add(-2 * time.Hour)
	_, err := r.tickNamespace(context.Background(), &logging.NoOpLogger{}, "stacks-1", stale)
	assert.NoError(t, err)
	mu.Lock()
	defer mu.Unlock()
	assert.Equal(t, []string{"sync:stacks-1", "create"}, order)
}

// TestTickNamespace_SyncFailureAbortsCheckCreation verifies that a CheckType
// sync failure aborts the tick before any Check is created, returning the
// input lastCreated so the namespace is retried on the next tick.
func TestTickNamespace_SyncFailureAbortsCheckCreation(t *testing.T) {
	var createCalled atomic.Bool
	mockClient := &MockClient{
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			createCalled.Store(true)
			return obj, nil
		},
	}
	syncErr := errors.New("sync failed")
	r := &Runner{
		checkRegistry: &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}},
		checksClient:  mockClient,
		checkTypeSyncer: &mockCheckTypeSyncer{
			syncFunc: func(ctx context.Context, logger logging.Logger, namespace string) error {
				return syncErr
			},
		},
		defaultEvalInterval: 1 * time.Hour,
		maxHistory:          defaultMaxHistory,
		log:                 &logging.NoOpLogger{},
	}
	stale := time.Now().Add(-2 * time.Hour)
	newLast, err := r.tickNamespace(context.Background(), &logging.NoOpLogger{}, "stacks-1", stale)
	assert.ErrorIs(t, err, syncErr)
	assert.Equal(t, stale, newLast)
	assert.False(t, createCalled.Load(), "tickNamespace must not create checks when CheckType sync fails")
}

// MT test helpers

// createTestMTRunner returns a Runner with no stackID and no orgService,
// which routes Run() to the multi-tenant scheduler path.
func createTestMTRunner(checkClient, typesClient *MockClient, checkRegistry checkregistry.CheckService) *Runner {
	return createTestMTRunnerWithConcurrency(checkClient, typesClient, checkRegistry)
}

func createTestMTRunnerWithConcurrency(checkClient, typesClient *MockClient, checkRegistry checkregistry.CheckService) *Runner {
	if checkClient.listFunc == nil {
		checkClient.listFunc = func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckList{Items: []advisorv0alpha1.Check{}}, nil
		}
	}
	if checkClient.createFunc == nil {
		checkClient.createFunc = func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			return obj, nil
		}
	}
	if checkClient.deleteFunc == nil {
		checkClient.deleteFunc = func(ctx context.Context, id resource.Identifier, opts resource.DeleteOptions) error {
			return nil
		}
	}
	if checkClient.patchFunc == nil {
		checkClient.patchFunc = func(ctx context.Context, id resource.Identifier, patch resource.PatchRequest, opts resource.PatchOptions, into resource.Object) error {
			return nil
		}
	}
	if typesClient.listFunc == nil {
		typesClient.listFunc = func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckTypeList{Items: []advisorv0alpha1.CheckType{}}, nil
		}
	}
	return &Runner{
		checkRegistry:       checkRegistry,
		checksClient:        checkClient,
		checksMetadata:      metadataGetterFromClient(checkClient),
		typesClient:         typesClient,
		checkTypeSyncer:     &mockCheckTypeSyncer{},
		defaultEvalInterval: 5 * time.Millisecond,
		maxHistory:          defaultMaxHistory,
		log:                 &logging.NoOpLogger{},
		orgService:          nil,
		stackID:             "",
	}
}

type mockCheckTypeSyncer struct {
	syncFunc func(ctx context.Context, logger logging.Logger, namespace string) error
}

func (m *mockCheckTypeSyncer) RegisterCheckTypesInNamespace(ctx context.Context, logger logging.Logger, namespace string) error {
	if m.syncFunc != nil {
		return m.syncFunc(ctx, logger, namespace)
	}
	return nil
}
