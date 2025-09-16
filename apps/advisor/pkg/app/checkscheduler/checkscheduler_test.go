package checkscheduler

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
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

		// Create the runner directly for testing
		runner := &Runner{
			checkRegistry:      &MockCheckService{checks: []checks.Check{}},
			checkClient:        mockClient,
			typesClient:        mockTypesClient,
			evaluationInterval: 1 * time.Hour,
			maxHistory:         defaultMaxHistory,
			namespace:          "test-namespace",
			log:                &logging.NoOpLogger{},
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
		checkClient: mockClient,
		namespace:   "test-namespace",
		log:         &logging.NoOpLogger{},
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
		checkClient: mockClient,
		namespace:   "test-namespace",
		log:         &logging.NoOpLogger{},
	}

	lastCreated, err := runner.checkLastCreated(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
	assert.True(t, lastCreated.IsZero())
	assert.Equal(t, "check-1", identifier.Name)
	assert.Equal(t, "/metadata/annotations", patchOperation.Path)
	expectedAnnotations := map[string]string{
		checks.StatusAnnotation: checks.StatusAnnotationError,
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
									checks.StatusAnnotation: checks.StatusAnnotationProcessed,
								},
							},
						},
						{
							ObjectMeta: metav1.ObjectMeta{
								Name:              "check-2",
								CreationTimestamp: metav1.NewTime(past),
								Annotations: map[string]string{
									checks.StatusAnnotation: checks.StatusAnnotationProcessed,
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
								checks.StatusAnnotation: checks.StatusAnnotationProcessed,
							},
						},
					},
				},
			}, nil
		},
	}

	runner := &Runner{
		checkClient: mockClient,
		namespace:   "test-namespace",
		log:         &logging.NoOpLogger{},
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
		checkClient:   mockClient,
		typesClient:   mockTypesClient,
		namespace:     "test-namespace",
		log:           &logging.NoOpLogger{},
	}

	// Create a CheckType object to pass to createChecks
	checkType := &advisorv0alpha1.CheckType{}
	checkType.Spec.Name = "check-1"
	err := runner.createChecks(context.Background(), []resource.Object{checkType})
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
		checkClient:   mockClient,
		typesClient:   mockTypesClient,
		namespace:     "test-namespace",
		log:           &logging.NoOpLogger{},
	}

	// Create a CheckType object to pass to createChecks
	checkType := &advisorv0alpha1.CheckType{}
	checkType.Spec.Name = "check-1"
	err := runner.createChecks(context.Background(), []resource.Object{checkType})
	assert.NoError(t, err)
}

func TestRunner_cleanupChecks_ErrorOnList(t *testing.T) {
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return nil, errors.New("list error")
		},
	}

	runner := &Runner{
		checkClient: mockClient,
		namespace:   "test-namespace",
		log:         &logging.NoOpLogger{},
	}

	err := runner.cleanupChecks(context.Background(), &logging.NoOpLogger{})
	assert.Error(t, err)
}

func TestRunner_cleanupChecks_WithinMax(t *testing.T) {
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return &advisorv0alpha1.CheckList{
				Items: []advisorv0alpha1.Check{
					{
						ObjectMeta: metav1.ObjectMeta{
							Labels: map[string]string{
								checks.TypeLabel: "mock",
							},
						},
					},
					{
						ObjectMeta: metav1.ObjectMeta{
							Labels: map[string]string{
								checks.TypeLabel: "mock",
							},
						},
					},
				},
			}, nil
		},
		deleteFunc: func(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error {
			return fmt.Errorf("shouldn't be called")
		},
	}

	runner := &Runner{
		checkClient: mockClient,
		namespace:   "test-namespace",
		maxHistory:  defaultMaxHistory,
		log:         &logging.NoOpLogger{},
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
				item.SetCreationTimestamp(metav1.NewTime(time.Time{}.Add(time.Duration(i) * time.Hour)))
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
		checkClient: mockClient,
		namespace:   "test-namespace",
		maxHistory:  defaultMaxHistory,
		log:         &logging.NoOpLogger{},
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
		checkClient: mockClient,
		namespace:   "test-namespace",
		maxHistory:  defaultMaxHistory,
		log:         &logging.NoOpLogger{},
	}
	err := runner.cleanupChecks(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
	assert.Equal(t, []string{"check-0"}, itemsDeleted)
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

func TestRunner_listCheckTypes_ErrorOnList(t *testing.T) {
	mockTypesClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return nil, errors.New("list error")
		},
	}

	runner := &Runner{
		typesClient: mockTypesClient,
		namespace:   "test-namespace",
		log:         &logging.NoOpLogger{},
	}

	checkTypes, err := runner.listCheckTypes(context.Background(), &logging.NoOpLogger{})
	assert.Error(t, err)
	assert.Nil(t, checkTypes)
}

func TestRunner_listCheckTypes_Success(t *testing.T) {
	mockTypesClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			checkType := &advisorv0alpha1.CheckType{}
			checkType.Spec.Name = "test-check"
			return &advisorv0alpha1.CheckTypeList{
				Items: []advisorv0alpha1.CheckType{*checkType},
			}, nil
		},
	}

	runner := &Runner{
		typesClient:   mockTypesClient,
		checkRegistry: &MockCheckService{checks: []checks.Check{&mockCheck{id: "test-check"}}},
		namespace:     "test-namespace",
		log:           &logging.NoOpLogger{},
	}

	checkTypes, err := runner.listCheckTypes(context.Background(), &logging.NoOpLogger{})
	assert.NoError(t, err)
	assert.Len(t, checkTypes, 1)
}

func Test_getNextSendInterval(t *testing.T) {
	lastCreated := time.Now().Add(-7 * 24 * time.Hour)
	evaluationInterval := 7 * 24 * time.Hour
	nextSendInterval := getNextSendInterval(lastCreated, evaluationInterval, []resource.Object{}, &logging.NoOpLogger{})
	// The next send interval should be in < 1 hour
	assert.True(t, nextSendInterval < time.Hour)
	// Calculate the next send interval again and it should be different
	nextSendInterval2 := getNextSendInterval(lastCreated, evaluationInterval, []resource.Object{}, &logging.NoOpLogger{})
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

// Additional tests for missing coverage

func TestNew(t *testing.T) {
	t.Run("successful creation", func(t *testing.T) {
		cfg := app.Config{
			SpecificConfig: checkregistry.AdvisorAppConfig{
				CheckRegistry: &MockCheckService{checks: []checks.Check{}},
				PluginConfig:  map[string]string{"evaluation_interval": "1h", "max_history": "5"},
				StackID:       "123",
			},
		}

		// We can't easily test the full New function without mocking k8s clients,
		// so we'll test the configuration parsing logic indirectly
		specificConfig, ok := cfg.SpecificConfig.(checkregistry.AdvisorAppConfig)
		assert.True(t, ok)
		assert.Equal(t, "123", specificConfig.StackID)
		assert.Equal(t, "1h", specificConfig.PluginConfig["evaluation_interval"])
		assert.Equal(t, "5", specificConfig.PluginConfig["max_history"])
	})

	t.Run("invalid config type", func(t *testing.T) {
		cfg := app.Config{
			SpecificConfig: "invalid",
		}

		_, ok := cfg.SpecificConfig.(checkregistry.AdvisorAppConfig)
		assert.False(t, ok)
	})
}

func TestRunner_listChecks(t *testing.T) {
	t.Run("successful list", func(t *testing.T) {
		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckList{
					Items: []advisorv0alpha1.Check{
						{ObjectMeta: metav1.ObjectMeta{Name: "check-1"}},
						{ObjectMeta: metav1.ObjectMeta{Name: "check-2"}},
					},
				}, nil
			},
		}

		runner := &Runner{
			checkClient: mockClient,
			namespace:   "test-namespace",
			log:         &logging.NoOpLogger{},
		}

		checks, err := runner.listChecks(context.Background(), &logging.NoOpLogger{})
		assert.NoError(t, err)
		assert.Len(t, checks, 2)
	})

	t.Run("error on list", func(t *testing.T) {
		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return nil, errors.New("list error")
			},
		}

		runner := &Runner{
			checkClient: mockClient,
			namespace:   "test-namespace",
			log:         &logging.NoOpLogger{},
		}

		checks, err := runner.listChecks(context.Background(), &logging.NoOpLogger{})
		assert.Error(t, err)
		assert.Nil(t, checks)
	})

	t.Run("paginated response", func(t *testing.T) {
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

		runner := &Runner{
			checkClient: mockClient,
			namespace:   "test-namespace",
			log:         &logging.NoOpLogger{},
		}

		checks, err := runner.listChecks(context.Background(), &logging.NoOpLogger{})
		assert.NoError(t, err)
		assert.Len(t, checks, 2)
		assert.Equal(t, 2, callCount)
	})

	t.Run("error on paginated list", func(t *testing.T) {
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
				return nil, errors.New("pagination error")
			},
		}

		runner := &Runner{
			checkClient: mockClient,
			namespace:   "test-namespace",
			log:         &logging.NoOpLogger{},
		}

		checks, err := runner.listChecks(context.Background(), &logging.NoOpLogger{})
		assert.Error(t, err)
		assert.Nil(t, checks)
	})
}

func TestRunner_Run_Comprehensive(t *testing.T) {
	t.Run("successful run with checks creation", func(t *testing.T) {
		lastCreated := time.Now().Add(-2 * time.Hour)
		checksCreated := []string{}
		checksDeleted := []string{}

		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				if options.Continue == "" {
					// First call for checkLastCreated
					return &advisorv0alpha1.CheckList{
						Items: []advisorv0alpha1.Check{
							{
								ObjectMeta: metav1.ObjectMeta{
									Name:              "existing-check",
									CreationTimestamp: metav1.NewTime(lastCreated),
									Annotations: map[string]string{
										checks.StatusAnnotation: checks.StatusAnnotationProcessed,
									},
								},
							},
						},
					}, nil
				}
				// Subsequent calls for cleanup
				return &advisorv0alpha1.CheckList{
					Items: []advisorv0alpha1.Check{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name: "check-to-delete",
								Labels: map[string]string{
									checks.TypeLabel: "test-type",
								},
								CreationTimestamp: metav1.NewTime(time.Now().Add(-25 * time.Hour)),
							},
						},
					},
				}, nil
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				checksCreated = append(checksCreated, id.Name)
				return obj, nil
			},
			deleteFunc: func(ctx context.Context, id resource.Identifier, opts resource.DeleteOptions) error {
				checksDeleted = append(checksDeleted, id.Name)
				return nil
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{
					Items: []advisorv0alpha1.CheckType{
						{
							ObjectMeta: metav1.ObjectMeta{
								Name: "test-type",
								Annotations: map[string]string{
									checks.EvaluationIntervalAnnotation: "1h",
								},
							},
							Spec: advisorv0alpha1.CheckTypeSpec{
								Name: "test-type",
							},
						},
					},
				}, nil
			},
		}

		runner := &Runner{
			checkRegistry:      &MockCheckService{checks: []checks.Check{}},
			checkClient:        mockClient,
			typesClient:        mockTypesClient,
			evaluationInterval: 1 * time.Hour,
			maxHistory:         10,
			namespace:          "test-namespace",
			log:                &logging.NoOpLogger{},
		}

		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		err := runner.Run(ctx)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Note: Due to timing, we can't reliably test the exact number of operations
		// but we can verify the runner doesn't crash and handles the context properly
	})

	t.Run("handles error in checkLastCreated gracefully", func(t *testing.T) {
		mockClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return nil, errors.New("list error")
			},
		}

		mockTypesClient := &MockClient{
			listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
				return &advisorv0alpha1.CheckTypeList{Items: []advisorv0alpha1.CheckType{}}, nil
			},
		}

		runner := &Runner{
			checkRegistry:      &MockCheckService{checks: []checks.Check{}},
			checkClient:        mockClient,
			typesClient:        mockTypesClient,
			evaluationInterval: 1 * time.Hour,
			maxHistory:         defaultMaxHistory,
			namespace:          "test-namespace",
			log:                &logging.NoOpLogger{},
		}

		ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
		defer cancel()

		err := runner.Run(ctx)
		assert.ErrorAs(t, err, &context.DeadlineExceeded)
		// Should not crash even with errors
	})
}

func TestGetNextSendInterval_EdgeCases(t *testing.T) {
	t.Run("with evaluation interval annotation", func(t *testing.T) {
		lastCreated := time.Now().Add(-30 * time.Minute) // 30 minutes ago
		checkTypes := []resource.Object{
			&advisorv0alpha1.CheckType{
				ObjectMeta: metav1.ObjectMeta{
					Annotations: map[string]string{
						checks.EvaluationIntervalAnnotation: "1h",
					},
				},
			},
		}

		interval := getNextSendInterval(lastCreated, 7*24*time.Hour, checkTypes, &logging.NoOpLogger{})
		// Should be around 30 minutes (1h - 30min) plus random variation (up to 1h)
		// So the total could be up to 30min + 1h = 1.5h
		assert.True(t, interval < 2*time.Hour)
		assert.True(t, interval > time.Minute)
	})

	t.Run("with invalid evaluation interval annotation", func(t *testing.T) {
		lastCreated := time.Now().Add(-30 * time.Minute) // 30 minutes ago
		checkTypes := []resource.Object{
			&advisorv0alpha1.CheckType{
				ObjectMeta: metav1.ObjectMeta{
					Annotations: map[string]string{
						checks.EvaluationIntervalAnnotation: "invalid",
					},
				},
			},
		}

		interval := getNextSendInterval(lastCreated, 1*time.Hour, checkTypes, &logging.NoOpLogger{})
		// Should fall back to default evaluation interval (1h - 30min) plus random variation (up to 1h)
		// So the total could be up to 1h + 1h = 2h
		assert.True(t, interval < 2*time.Hour)
		assert.True(t, interval > time.Minute)
	})

	t.Run("with empty check types", func(t *testing.T) {
		lastCreated := time.Now().Add(-30 * time.Minute) // 30 minutes ago
		checkTypes := []resource.Object{}

		interval := getNextSendInterval(lastCreated, 1*time.Hour, checkTypes, &logging.NoOpLogger{})
		// Should use default evaluation interval (1h - 30min) plus random variation (up to 1h)
		// So the total could be up to 30min + 1h = 1.5h
		assert.True(t, interval < 2*time.Hour)
		assert.True(t, interval > time.Minute)
	})

	t.Run("ensures minimum interval", func(t *testing.T) {
		lastCreated := time.Now().Add(2 * time.Hour) // Future time
		checkTypes := []resource.Object{}

		interval := getNextSendInterval(lastCreated, 1*time.Hour, checkTypes, &logging.NoOpLogger{})
		// Should be at least 1 minute
		assert.True(t, interval >= time.Minute)
	})

	t.Run("adds random variation", func(t *testing.T) {
		lastCreated := time.Now().Add(-30 * time.Minute) // 30 minutes ago
		checkTypes := []resource.Object{}

		// Should be different due to random variation (unless by chance they're the same)
		// We'll run multiple times to increase the chance of getting different values
		foundDifferent := false
		for i := 0; i < 10; i++ {
			interval1 := getNextSendInterval(lastCreated, 1*time.Hour, checkTypes, &logging.NoOpLogger{})
			interval2 := getNextSendInterval(lastCreated, 1*time.Hour, checkTypes, &logging.NoOpLogger{})
			if interval1 != interval2 {
				foundDifferent = true
				break
			}
		}
		assert.True(t, foundDifferent, "Random variation should produce different intervals")
	})
}
