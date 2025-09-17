package checkscheduler

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestRunner_Run(t *testing.T) {
	t.Run("does not crash when error on list", func(t *testing.T) {
		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return nil, errors.New("list error")
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				return &advisorv0alpha1.Check{}, nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{Items: []advisorv0alpha1.CheckType{}}, nil
			},
		}

		runner := &Runner{
			client:             mockClient,
			typesClient:        mockTypesClient,
			log:                &logging.NoOpLogger{},
			evaluationInterval: 1 * time.Hour,
		}

		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		err := runner.Run(ctx)
		assert.ErrorAs(t, err, &context.Canceled)
	})
}

func TestRunner_checkLastCreated_ErrorOnList(t *testing.T) {
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return nil, errors.New("list error")
		},
	}

	runner := &Runner{
		client: mockClient,
		log:    &logging.NoOpLogger{},
	}

	lastCreated, err := runner.checkLastCreated(context.Background(), &logging.NoOpLogger{})
	assert.Error(t, err)
	assert.True(t, lastCreated.IsZero())
}

func TestRunner_checkLastCreated_UnprocessedCheck(t *testing.T) {
	patchOperation := resource.PatchOperation{}
	identifier := resource.Identifier{}

	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckList{
				Items: []advisorv0alpha1.Check{
					{
						ObjectMeta: metav1.ObjectMeta{
							Name: "check-1",
						},
					},
				},
			}, nil
		},
		patchFunc: func(ctx context.Context, id resource.Identifier, patch resource.PatchRequest, options resource.PatchOptions, into resource.Object) error {
			patchOperation = patch.Operations[0]
			identifier = id
			return nil
		},
	}

	runner := &Runner{
		client: mockClient,
		log:    &logging.NoOpLogger{},
	}

	lastCreated, err := runner.checkLastCreated(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
	assert.True(t, lastCreated.IsZero())
	assert.Equal(t, "check-1", identifier.Name)
	assert.Equal(t, "/metadata/annotations", patchOperation.Path)
	expectedAnnotations := map[string]string{
		checks.StatusAnnotation: "error",
	}
	assert.Equal(t, expectedAnnotations, patchOperation.Value)
}

func TestRunner_checkLastCreated_PaginatedResponse(t *testing.T) {
	// Create checks with different creation times
	past := time.Now().Add(-1 * time.Hour)
	now := time.Now()

	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			if options.Continue == "" {
				// First page - return oldest and middle checks with continue token
				return &advisorv0alpha1.CheckList{
					ListMeta: metav1.ListMeta{
						Continue: "continue-token-123",
					},
					Items: []advisorv0alpha1.Check{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name:              "check-1",
								CreationTimestamp: metav1.NewTime(past),
								Annotations: map[string]string{
									checks.StatusAnnotation: "completed",
								},
							},
						},
						{
							ObjectMeta: metav1.ObjectMeta{
								Name:              "check-2",
								CreationTimestamp: metav1.NewTime(past),
								Annotations: map[string]string{
									checks.StatusAnnotation: "completed",
								},
							},
						},
					},
				}, nil
			}
			// Second page - verify continue token is passed and return newest check
			assert.Equal(t, "continue-token-123", options.Continue)
			return &advisorv0alpha1.CheckList{
				Items: []advisorv0alpha1.Check{
					{
						ObjectMeta: metav1.ObjectMeta{
							Name:              "check-3",
							CreationTimestamp: metav1.NewTime(now),
							Annotations: map[string]string{
								checks.StatusAnnotation: "completed",
							},
						},
					},
				},
			}, nil
		},
	}

	runner := &Runner{
		client: mockClient,
		log:    &logging.NoOpLogger{},
	}

	lastCreated, err := runner.checkLastCreated(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
	assert.Equal(t, now.Truncate(time.Second), lastCreated.Truncate(time.Second))
}

func TestRunner_createChecks_ErrorOnCreate(t *testing.T) {
	mockCheckService := &MockCheckService{checks: []checks.Check{&mockCheck{id: "check-1"}}}

	mockClient := &MockClient{
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			return nil, errors.New("create error")
		},
	}

	mockTypesClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			checkType := &advisorv0alpha1.CheckType{}
			checkType.Spec.Name = "check-1"
			return &advisorv0alpha1.CheckTypeList{
				Items: []advisorv0alpha1.CheckType{*checkType},
			}, nil
		},
	}

	runner := &Runner{
		checkRegistry: mockCheckService,
		client:        mockClient,
		typesClient:   mockTypesClient,
		log:           &logging.NoOpLogger{},
	}

	err := runner.createChecks(context.Background(), &logging.NoOpLogger{})
	assert.Error(t, err)
}

func TestRunner_createChecks_Success(t *testing.T) {
	mockCheckService := &MockCheckService{checks: []checks.Check{&mockCheck{id: "check-1"}}}

	mockClient := &MockClient{
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			return &advisorv0alpha1.Check{}, nil
		},
	}

	mockTypesClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			checkType := &advisorv0alpha1.CheckType{}
			checkType.Spec.Name = "check-1"
			return &advisorv0alpha1.CheckTypeList{
				Items: []advisorv0alpha1.CheckType{*checkType},
			}, nil
		},
	}

	runner := &Runner{
		checkRegistry: mockCheckService,
		client:        mockClient,
		typesClient:   mockTypesClient,
		log:           &logging.NoOpLogger{},
	}

	err := runner.createChecks(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
}

func TestRunner_cleanupChecks_ErrorOnList(t *testing.T) {
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return nil, errors.New("list error")
		},
	}

	runner := &Runner{
		client: mockClient,
		log:    &logging.NoOpLogger{},
	}

	err := runner.cleanupChecks(context.Background(), &logging.NoOpLogger{})
	assert.Error(t, err)
}

func TestRunner_cleanupChecks_WithinMax(t *testing.T) {
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckList{
				Items: []advisorv0alpha1.Check{{}, {}},
			}, nil
		},
		deleteFunc: func(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error {
			return fmt.Errorf("shouldn't be called")
		},
	}

	runner := &Runner{
		client: mockClient,
		log:    &logging.NoOpLogger{},
	}

	err := runner.cleanupChecks(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
}

func TestRunner_cleanupChecks_ErrorOnDelete(t *testing.T) {
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			items := make([]advisorv0alpha1.Check, 0, defaultMaxHistory+1)
			for i := 0; i < defaultMaxHistory+1; i++ {
				item := advisorv0alpha1.Check{}
				item.SetLabels(map[string]string{
					checks.TypeLabel: "mock",
				})
				items = append(items, item)
			}
			return &advisorv0alpha1.CheckList{
				Items: items,
			}, nil
		},
		deleteFunc: func(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error {
			return errors.New("delete error")
		},
	}

	runner := &Runner{
		client:     mockClient,
		maxHistory: defaultMaxHistory,
		log:        &logging.NoOpLogger{},
	}
	err := runner.cleanupChecks(context.Background(), &logging.NoOpLogger{})
	assert.ErrorContains(t, err, "delete error")
}

func TestRunner_cleanupChecks_Success(t *testing.T) {
	itemsDeleted := []string{}
	items := make([]advisorv0alpha1.Check, 0, defaultMaxHistory+1)
	for i := 0; i < defaultMaxHistory+1; i++ {
		item := advisorv0alpha1.Check{}
		item.SetName(fmt.Sprintf("check-%d", i))
		item.SetLabels(map[string]string{
			checks.TypeLabel: "mock",
		})
		item.SetCreationTimestamp(metav1.NewTime(time.Time{}.Add(time.Duration(i) * time.Hour)))
		items = append(items, item)
	}
	// shuffle the items to ensure the oldest are deleted
	rand.Shuffle(len(items), func(i, j int) { items[i], items[j] = items[j], items[i] })

	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckList{
				Items: items,
			}, nil
		},
		deleteFunc: func(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error {
			itemsDeleted = append(itemsDeleted, identifier.Name)
			return nil
		},
	}

	runner := &Runner{
		client:     mockClient,
		maxHistory: defaultMaxHistory,
		log:        &logging.NoOpLogger{},
	}
	err := runner.cleanupChecks(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
	assert.Equal(t, []string{"check-0"}, itemsDeleted)
}

func Test_getEvaluationInterval(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		interval, err := getEvaluationInterval(map[string]string{})
		assert.NoError(t, err)
		assert.Equal(t, 7*24*time.Hour, interval)
	})

	t.Run("invalid", func(t *testing.T) {
		interval, err := getEvaluationInterval(map[string]string{"evaluation_interval": "invalid"})
		assert.Error(t, err)
		assert.Zero(t, interval)
	})

	t.Run("custom", func(t *testing.T) {
		interval, err := getEvaluationInterval(map[string]string{"evaluation_interval": "1h"})
		assert.NoError(t, err)
		assert.Equal(t, time.Hour, interval)
	})
}

func Test_getMaxHistory(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		history, err := getMaxHistory(map[string]string{})
		assert.NoError(t, err)
		assert.Equal(t, 10, history)
	})

	t.Run("invalid", func(t *testing.T) {
		history, err := getMaxHistory(map[string]string{"max_history": "invalid"})
		assert.Error(t, err)
		assert.Zero(t, history)
	})

	t.Run("custom", func(t *testing.T) {
		history, err := getMaxHistory(map[string]string{"max_history": "5"})
		assert.NoError(t, err)
		assert.Equal(t, 5, history)
	})
}

func Test_getNextSendInterval(t *testing.T) {
	lastCreated := time.Now().Add(-7 * 24 * time.Hour)
	evaluationInterval := 7 * 24 * time.Hour
	nextSendInterval := getNextSendInterval(lastCreated, evaluationInterval)
	// The next send interval should be in < 1 hour
	assert.True(t, nextSendInterval < time.Hour)
	// Calculate the next send interval again and it should be different
	nextSendInterval2 := getNextSendInterval(lastCreated, evaluationInterval)
	assert.NotEqual(t, nextSendInterval, nextSendInterval2)
}

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
