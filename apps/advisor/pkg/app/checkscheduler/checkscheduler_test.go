package checkscheduler

import (
	"context"
	"errors"
	"fmt"
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

// TestRunner_Run tests the main Run function with various scenarios
func TestRunner_Run(t *testing.T) {
	t.Run("handles context cancellation gracefully", func(t *testing.T) {
		runner := createTestRunner(&MockClient{}, &MockClient{})

		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		err := runner.Run(ctx)
		assert.ErrorAs(t, err, &context.Canceled)
	})

	t.Run("handles timeout gracefully", func(t *testing.T) {
		runner := createTestRunner(&MockClient{}, &MockClient{})

		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
		defer cancel()

		err := runner.Run(ctx)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
	})

	t.Run("handles check types list error", func(t *testing.T) {
		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return nil, errors.New("list check types error")
			},
		}

		runner := createTestRunner(&MockClient{}, mockTypesClient)
		err := runner.Run(context.Background())
		assert.ErrorContains(t, err, "list check types error")
	})

	t.Run("handles check list error gracefully", func(t *testing.T) {
		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return nil, errors.New("list checks error")
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{Items: []advisorv0alpha1.CheckType{}}, nil
			},
		}

		runner := createTestRunner(mockClient, mockTypesClient)
		err := runner.Run(context.Background())
		assert.ErrorContains(t, err, "list checks error")
	})
}

// TestRunner_Run_CheckCreation tests check creation scenarios
func TestRunner_Run_CheckCreation(t *testing.T) {
	t.Run("does not create checks on first run when no previous checks exist", func(t *testing.T) {
		checksCreated := []string{}

		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				// Return empty list - no previous checks
				return &advisorv0alpha1.CheckList{Items: []advisorv0alpha1.Check{}}, nil
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				checksCreated = append(checksCreated, id.Name)
				return obj, nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{
					Items: []advisorv0alpha1.CheckType{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name: "test-check",
								Annotations: map[string]string{
									checks.EvaluationIntervalAnnotation: "1h",
								},
							},
							Spec: advisorv0alpha1.CheckTypeSpec{
								Name: "test-check",
							},
						},
					},
				}, nil
			},
		}

		// Create a mock check service with one check to match the check type
		mockCheckService := &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}}
		runner := createTestRunnerWithRegistry(mockClient, mockTypesClient, mockCheckService)

		err := runAndTimeout(runner)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Should not create checks on first run when no previous checks exist
		assert.Empty(t, checksCreated, "Should not create checks on first run when no previous checks exist")
	})

	t.Run("creates checks when evaluation interval has passed", func(t *testing.T) {
		checksCreated := []string{}

		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				// Return a check that was created long ago (past the evaluation interval)
				return &advisorv0alpha1.CheckList{
					Items: []advisorv0alpha1.Check{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name:              "old-check",
								CreationTimestamp: metav1.NewTime(time.Now().Add(-3 * time.Hour)), // 3 hours ago
								Annotations: map[string]string{
									checks.StatusAnnotation: checks.StatusAnnotationProcessed,
								},
							},
						},
					},
				}, nil
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				checksCreated = append(checksCreated, id.Name)
				return obj, nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{
					Items: []advisorv0alpha1.CheckType{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name: "test-check",
								Annotations: map[string]string{
									checks.EvaluationIntervalAnnotation: "1h", // 1 hour interval
								},
							},
							Spec: advisorv0alpha1.CheckTypeSpec{
								Name: "test-check",
							},
						},
					},
				}, nil
			},
		}

		// Create a mock check service with one check to match the check type
		mockCheckService := &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}}
		runner := createTestRunnerWithRegistry(mockClient, mockTypesClient, mockCheckService)

		err := runAndTimeout(runner)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Should create checks when the evaluation interval has passed
		assert.Greater(t, len(checksCreated), 0, "Should create checks when evaluation interval has passed")
	})

	t.Run("skips check creation when evaluation interval is 0", func(t *testing.T) {
		checksCreated := []string{}

		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckList{Items: []advisorv0alpha1.Check{}}, nil
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				checksCreated = append(checksCreated, id.Name)
				return obj, nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{
					Items: []advisorv0alpha1.CheckType{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name: "test-check",
								Annotations: map[string]string{
									checks.EvaluationIntervalAnnotation: "0",
								},
							},
							Spec: advisorv0alpha1.CheckTypeSpec{
								Name: "test-check",
							},
						},
					},
				}, nil
			},
		}

		// Create a mock check service with one check to match the check type
		mockCheckService := &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}}
		runner := createTestRunnerWithRegistry(mockClient, mockTypesClient, mockCheckService)

		err := runAndTimeout(runner)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Should not create any checks when interval is 0
		assert.Empty(t, checksCreated)
	})
}

// TestRunner_Run_CheckCleanup tests check cleanup scenarios
func TestRunner_Run_CheckCleanup(t *testing.T) {
	t.Run("cleans up old checks when limit exceeded", func(t *testing.T) {
		checksDeleted := []string{}

		// Create checks that exceed the max history limit
		items := make([]advisorv0alpha1.Check, 0, defaultMaxHistory+2)
		for i := 0; i < defaultMaxHistory+2; i++ {
			item := advisorv0alpha1.Check{}
			item.SetName(fmt.Sprintf("check-%d", i))
			item.SetLabels(map[string]string{
				checks.TypeLabel: "test-type",
			})
			item.SetCreationTimestamp(metav1.NewTime(time.Now().Add(-time.Duration(i) * time.Hour)))
			items = append(items, item)
		}

		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckList{Items: items}, nil
			},
			deleteFunc: func(ctx context.Context, id resource.Identifier, opts resource.DeleteOptions) error {
				checksDeleted = append(checksDeleted, id.Name)
				return nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{Items: []advisorv0alpha1.CheckType{}}, nil
			},
		}

		runner := createTestRunner(mockClient, mockTypesClient)

		err := runAndTimeout(runner)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Should delete some checks due to cleanup
		assert.Greater(t, len(checksDeleted), 0)
	})
}

// TestRunner_Run_UnprocessedChecks tests handling of unprocessed checks
func TestRunner_Run_UnprocessedChecks(t *testing.T) {
	t.Run("marks unprocessed checks as error", func(t *testing.T) {
		patchOperations := []resource.PatchOperation{}

		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckList{
					Items: []advisorv0alpha1.Check{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name: "unprocessed-check",
								// No status annotation - unprocessed
							},
						},
					},
				}, nil
			},
			patchFunc: func(ctx context.Context, id resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions, into resource.Object) error {
				patchOperations = append(patchOperations, patch.Operations...)
				return nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{Items: []advisorv0alpha1.CheckType{}}, nil
			},
		}

		runner := createTestRunner(mockClient, mockTypesClient)

		err := runAndTimeout(runner)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Should patch unprocessed check with error status
		assert.Greater(t, len(patchOperations), 0)
	})
}

// TestRunner_Run_Pagination tests pagination handling
func TestRunner_Run_Pagination(t *testing.T) {
	t.Run("handles paginated check lists", func(t *testing.T) {
		callCount := 0

		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				callCount++
				if callCount == 1 {
					return &advisorv0alpha1.CheckList{
						ListMeta: metav1.ListMeta{Continue: "continue-token"},
						Items: []advisorv0alpha1.Check{
							{ObjectMeta: metav1.ObjectMeta{Name: "check-1"}},
						},
					}, nil
				}
				return &advisorv0alpha1.CheckList{
					Items: []advisorv0alpha1.Check{
						{ObjectMeta: metav1.ObjectMeta{Name: "check-2"}},
					},
				}, nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{Items: []advisorv0alpha1.CheckType{}}, nil
			},
		}

		runner := createTestRunner(mockClient, mockTypesClient)

		err := runAndTimeout(runner)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Should handle pagination correctly
		assert.Equal(t, 2, callCount)
	})
}

// TestRunner_Run_EvaluationInterval tests evaluation interval handling
func TestRunner_Run_EvaluationInterval(t *testing.T) {
	t.Run("uses custom evaluation interval from annotation", func(t *testing.T) {
		checksCreated := []string{}

		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckList{Items: []advisorv0alpha1.Check{}}, nil
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				checksCreated = append(checksCreated, id.Name)
				return obj, nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{
					Items: []advisorv0alpha1.CheckType{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name: "test-check",
								Annotations: map[string]string{
									checks.EvaluationIntervalAnnotation: "30m",
								},
							},
							Spec: advisorv0alpha1.CheckTypeSpec{
								Name: "test-check",
							},
						},
					},
				}, nil
			},
		}

		// Create a mock check service with one check to match the check type
		mockCheckService := &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}}
		runner := createTestRunnerWithRegistry(mockClient, mockTypesClient, mockCheckService)

		err := runAndTimeout(runner)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Should not have had time to create the check
		assert.Empty(t, checksCreated)
	})

	t.Run("handles invalid evaluation interval gracefully", func(t *testing.T) {
		checksCreated := []string{}

		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				// Return a check that was created long ago (past the evaluation interval)
				return &advisorv0alpha1.CheckList{
					Items: []advisorv0alpha1.Check{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name:              "old-check",
								CreationTimestamp: metav1.NewTime(time.Now().Add(-3 * time.Hour)), // 3 hours ago
								Annotations: map[string]string{
									checks.StatusAnnotation: checks.StatusAnnotationProcessed,
								},
							},
						},
					},
				}, nil
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				checksCreated = append(checksCreated, id.Name)
				return obj, nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{
					Items: []advisorv0alpha1.CheckType{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name: "test-check",
								Annotations: map[string]string{
									checks.EvaluationIntervalAnnotation: "invalid-duration", // 1 hour interval
								},
							},
							Spec: advisorv0alpha1.CheckTypeSpec{
								Name: "test-check",
							},
						},
					},
				}, nil
			},
		}

		// Create a mock check service with one check to match the check type
		mockCheckService := &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}}
		runner := createTestRunnerWithRegistry(mockClient, mockTypesClient, mockCheckService)

		err := runAndTimeout(runner)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Ignores the invalid interval and uses the default
		assert.Greater(t, len(checksCreated), 0)
	})
}

// Helper functions

// runAndTimeout runs a runner with a short timeout for testing purposes.
// This is used to terminate the runner's infinite loop in tests that don't specifically test timeout behavior.
func runAndTimeout(runner *Runner) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer cancel()
	return runner.Run(ctx)
}

// createTestRunner creates a test runner with mock clients
func createTestRunner(checkClient, typesClient *MockClient) *Runner {
	return createTestRunnerWithRegistry(checkClient, typesClient, &MockCheckService{checks: []checks.Check{}})
}

// createTestRunnerWithRegistry creates a test runner with mock clients and custom registry
func createTestRunnerWithRegistry(checkClient, typesClient *MockClient, checkRegistry checkregistry.CheckService) *Runner {
	// Ensure mock clients have default implementations
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
			// Return empty list to match the empty MockCheckService
			return &advisorv0alpha1.CheckTypeList{Items: []advisorv0alpha1.CheckType{}}, nil
		}
	}

	return &Runner{
		checkRegistry:       checkRegistry,
		checkClient:         checkClient,
		typesClient:         typesClient,
		defaultEvalInterval: 1 * time.Hour,
		maxHistory:          defaultMaxHistory,
		namespace:           "test-namespace",
		log:                 &logging.NoOpLogger{},
		randomVariationMax:  1 * time.Millisecond, // Small variation for testing
	}
}

// Mock implementations

type MockClient struct {
	resource.Client
	listFunc   func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error)
	createFunc func(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.CreateOptions) (resource.Object, error)
	deleteFunc func(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error
	patchFunc  func(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions, into resource.Object) error
}

func (m *MockClient) List(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
	return m.listFunc(ctx, namespace, options)
}

func (m *MockClient) Create(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.CreateOptions) (resource.Object, error) {
	return m.createFunc(ctx, identifier, obj, options)
}

func (m *MockClient) Delete(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error {
	return m.deleteFunc(ctx, identifier, options)
}

func (m *MockClient) PatchInto(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions, into resource.Object) error {
	return m.patchFunc(ctx, identifier, patch, options, into)
}

type MockCheckService struct {
	checks []checks.Check
}

func (m *MockCheckService) Checks() []checks.Check {
	return m.checks
}

type mockCheck struct {
	checks.Check
	id    string
	steps []checks.Step
}

func (m *mockCheck) ID() string {
	return m.id
}

func (m *mockCheck) Steps() []checks.Step {
	return m.steps
}
