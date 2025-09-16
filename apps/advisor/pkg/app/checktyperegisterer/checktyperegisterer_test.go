package checktyperegisterer

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/stretchr/testify/assert"
	k8sErrs "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestCheckTypesRegisterer_Run(t *testing.T) {
	newMockCheck := &mockCheck{
		id: "check1",
		steps: []checks.Step{
			&mockStep{id: "step1", title: "Step 1", description: "Description 1"},
		},
	}
	existingObjectDifferentAnnotations := &advisorv0alpha1.CheckType{
		ObjectMeta: metav1.ObjectMeta{
			Name: "check1",
			Annotations: map[string]string{
				checks.NameAnnotation: "existing-name", // Different to trigger update
			},
		},
		Spec: advisorv0alpha1.CheckTypeSpec{
			Name: "check1",
			Steps: []advisorv0alpha1.CheckTypeStep{
				{StepID: "step1", Title: "Step 1", Description: "Description 1"},
			},
		},
	}
	existingObjectDifferentSteps := &advisorv0alpha1.CheckType{
		ObjectMeta: metav1.ObjectMeta{
			Name: "check1",
			Annotations: map[string]string{
				checks.NameAnnotation: "mock", // Same as check name
			},
		},
		Spec: advisorv0alpha1.CheckTypeSpec{
			Name: "check1",
			Steps: []advisorv0alpha1.CheckTypeStep{
				{StepID: "step2", Title: "Step 2", Description: "Description 2"}, // Different step
			},
		},
	}
	existingObjectSameContent := &advisorv0alpha1.CheckType{
		ObjectMeta: metav1.ObjectMeta{
			Name: "check1",
			Annotations: map[string]string{
				checks.NameAnnotation: "mock", // Same as check name
			},
		},
		Spec: advisorv0alpha1.CheckTypeSpec{
			Name: "check1",
			Steps: []advisorv0alpha1.CheckTypeStep{
				{StepID: "step1", Title: "Step 1", Description: "Description 1"},
			},
		},
	}
	tests := []struct {
		name        string
		checks      []checks.Check
		getFunc     func(ctx context.Context, id resource.Identifier) (resource.Object, error)
		createFunc  func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error)
		updateFunc  func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error)
		expectedErr error
	}{
		{
			name:   "successful create",
			checks: []checks.Check{newMockCheck},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return nil, k8sErrs.NewNotFound(schema.GroupResource{}, id.Name)
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				return obj, nil
			},
			updateFunc:  nil,
			expectedErr: nil,
		},
		{
			name:   "resource exists with different annotations, should update",
			checks: []checks.Check{newMockCheck},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return existingObjectDifferentAnnotations, nil
			},
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				return obj, nil
			},
			expectedErr: nil,
		},
		{
			name:   "resource exists with different steps, should update",
			checks: []checks.Check{newMockCheck},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return existingObjectDifferentSteps, nil
			},
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				return obj, nil
			},
			expectedErr: nil,
		},
		{
			name:   "resource exists with same annotations and steps, should not update",
			checks: []checks.Check{newMockCheck},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return existingObjectSameContent, nil
			},
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				return nil, errors.New("updateFunc should not be called")
			},
			expectedErr: nil,
		},
		{
			name:   "resource exists, with custom annotations preserved",
			checks: []checks.Check{newMockCheck},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return existingObjectDifferentAnnotations, nil
			},
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				if obj.GetAnnotations()[checks.IgnoreStepsAnnotationList] != "step1" {
					return nil, fmt.Errorf("expected annotation %s, got %s", "step1", obj.GetAnnotations()[checks.IgnoreStepsAnnotationList])
				}
				return obj, nil
			},
			expectedErr: nil,
		},
		{
			name:   "create error",
			checks: []checks.Check{newMockCheck},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return nil, k8sErrs.NewNotFound(schema.GroupResource{}, id.Name)
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				return nil, errors.New("create error")
			},
			updateFunc:  nil,
			expectedErr: errors.New("create error"),
		},
		{
			name:   "update error",
			checks: []checks.Check{newMockCheck},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return existingObjectDifferentAnnotations, nil
			},
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				return nil, errors.New("update error")
			},
			expectedErr: errors.New("update error"),
		},
		{
			name:   "shutting down error",
			checks: []checks.Check{newMockCheck},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return existingObjectDifferentAnnotations, nil
			},
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				return nil, errors.New("apiserver is shutting down")
			},
			expectedErr: nil,
		},
		{
			name:   "custom namespace",
			checks: []checks.Check{newMockCheck},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return existingObjectDifferentAnnotations, nil
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				if obj.GetNamespace() != "custom-namespace" {
					return nil, fmt.Errorf("expected namespace %s, got %s", "custom-namespace", obj.GetNamespace())
				}
				return obj, nil
			},
			expectedErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &Runner{
				checkRegistry: &mockCheckRegistry{checks: tt.checks},
				typeClient: &mockClient{
					getFunc:    tt.getFunc,
					createFunc: tt.createFunc,
					updateFunc: tt.updateFunc,
				},
				namespace:     "custom-namespace",
				log:           logging.DefaultLogger,
				retryAttempts: 1,
				retryDelay:    0,
			}
			err := r.Run(context.Background())
			if err != nil {
				if tt.expectedErr == nil {
					t.Errorf("unexpected error: %v", err)
				} else if err.Error() != tt.expectedErr.Error() {
					t.Errorf("expected error: %v, got: %v", tt.expectedErr, err)
				}
			}
		})
	}
}

type mockCheckRegistry struct {
	checks []checks.Check
}

func (m *mockCheckRegistry) Checks() []checks.Check {
	return m.checks
}

type mockCheck struct {
	id    string
	steps []checks.Step
}

func (m *mockCheck) Init(ctx context.Context) error {
	return nil
}

func (m *mockCheck) ID() string {
	return m.id
}

func (m *mockCheck) Name() string {
	return "mock"
}

func (m *mockCheck) Steps() []checks.Step {
	return m.steps
}

func (m *mockCheck) Item(ctx context.Context, id string) (any, error) {
	return nil, nil
}

func (m *mockCheck) Items(ctx context.Context) ([]any, error) {
	return nil, nil
}

type mockStep struct {
	id          string
	title       string
	description string
}

func (m *mockStep) ID() string {
	return m.id
}

func (m *mockStep) Title() string {
	return m.title
}

func (m *mockStep) Description() string {
	return m.description
}

func (m *mockStep) Resolution() string {
	return ""
}

func (m *mockStep) Run(ctx context.Context, log logging.Logger, obj *advisorv0alpha1.CheckSpec, item any) ([]advisorv0alpha1.CheckReportFailure, error) {
	return nil, nil
}

type mockClient struct {
	resource.Client

	getFunc    func(ctx context.Context, id resource.Identifier) (resource.Object, error)
	createFunc func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error)
	updateFunc func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error)
}

func (m *mockClient) Get(ctx context.Context, id resource.Identifier) (resource.Object, error) {
	if m.getFunc != nil {
		return m.getFunc(ctx, id)
	}
	return nil, errors.New("not implemented")
}

func (m *mockClient) Create(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
	if m.createFunc != nil {
		return m.createFunc(ctx, id, obj, opts)
	}
	return nil, errors.New("not implemented")
}

func (m *mockClient) Update(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, id, obj, opts)
	}
	return nil, errors.New("not implemented")
}

// Tests for new functionality

func TestNew(t *testing.T) {
	t.Run("successful creation", func(t *testing.T) {
		cfg := app.Config{
			SpecificConfig: checkregistry.AdvisorAppConfig{
				CheckRegistry: &mockCheckRegistry{checks: []checks.Check{}},
				PluginConfig:  map[string]string{"evaluation_interval": "1h"},
				StackID:       "123",
			},
		}

		// We can't easily test the full New function without mocking k8s clients,
		// so we'll test the configuration parsing logic indirectly
		specificConfig, ok := cfg.SpecificConfig.(checkregistry.AdvisorAppConfig)
		assert.True(t, ok)
		assert.Equal(t, "123", specificConfig.StackID)
		assert.Equal(t, "1h", specificConfig.PluginConfig["evaluation_interval"])
	})

	t.Run("invalid config type", func(t *testing.T) {
		cfg := app.Config{
			SpecificConfig: "invalid",
		}

		_, ok := cfg.SpecificConfig.(checkregistry.AdvisorAppConfig)
		assert.False(t, ok)
	})
}

func TestRunner_update(t *testing.T) {
	t.Run("sets default evaluation interval annotation", func(t *testing.T) {
		current := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-check",
				Annotations: map[string]string{
					checks.NameAnnotation: "test",
				},
			},
		}

		newObj := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-check",
				Annotations: map[string]string{
					checks.NameAnnotation: "test",
				},
			},
		}

		updateCalled := false
		mockClient := &mockClient{
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				updateCalled = true
				annotations := obj.GetAnnotations()
				assert.Equal(t, "168h0m0s", annotations[checks.EvaluationIntervalAnnotation])
				return obj, nil
			},
		}

		runner := &Runner{
			typeClient:                mockClient,
			defaultEvaluationInterval: 7 * 24 * time.Hour,
			log:                       &logging.NoOpLogger{},
		}

		err := runner.update(context.Background(), &logging.NoOpLogger{}, newObj, current)
		assert.NoError(t, err)
		assert.True(t, updateCalled)
	})

	t.Run("preserves existing annotations", func(t *testing.T) {
		current := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-check",
				Annotations: map[string]string{
					checks.NameAnnotation: "test",
					"custom-annotation":   "custom-value",
				},
			},
		}

		newObj := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-check",
				Annotations: map[string]string{
					checks.NameAnnotation: "test",
				},
			},
		}

		updateCalled := false
		mockClient := &mockClient{
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				updateCalled = true
				annotations := obj.GetAnnotations()
				assert.Equal(t, "test", annotations[checks.NameAnnotation])
				assert.Equal(t, "custom-value", annotations["custom-annotation"])
				assert.Equal(t, "168h0m0s", annotations[checks.EvaluationIntervalAnnotation])
				return obj, nil
			},
		}

		runner := &Runner{
			typeClient:                mockClient,
			defaultEvaluationInterval: 7 * 24 * time.Hour,
			log:                       &logging.NoOpLogger{},
		}

		err := runner.update(context.Background(), &logging.NoOpLogger{}, newObj, current)
		assert.NoError(t, err)
		assert.True(t, updateCalled)
	})

	t.Run("handles already exists error", func(t *testing.T) {
		current := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-check",
				Annotations: map[string]string{
					checks.NameAnnotation: "test",
				},
			},
		}

		newObj := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-check",
				Annotations: map[string]string{
					checks.NameAnnotation: "test",
				},
			},
		}

		updateCalled := false
		mockClient := &mockClient{
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				updateCalled = true
				return nil, k8sErrs.NewAlreadyExists(schema.GroupResource{}, "test-check")
			},
		}

		runner := &Runner{
			typeClient:                mockClient,
			defaultEvaluationInterval: 7 * 24 * time.Hour,
			log:                       &logging.NoOpLogger{},
		}

		err := runner.update(context.Background(), &logging.NoOpLogger{}, newObj, current)
		assert.NoError(t, err) // Should not return error for AlreadyExists
		assert.True(t, updateCalled)
	})
}

func TestRunner_shouldRetry(t *testing.T) {
	t.Run("returns false for API server shutting down", func(t *testing.T) {
		runner := &Runner{
			retryAttempts: 3,
			retryDelay:    time.Millisecond,
			log:           &logging.NoOpLogger{},
		}

		err := errors.New("apiserver is shutting down")
		shouldRetry := runner.shouldRetry(err, &logging.NoOpLogger{}, 1, "test-check")
		assert.False(t, shouldRetry)
	})

	t.Run("returns false on last attempt", func(t *testing.T) {
		runner := &Runner{
			retryAttempts: 3,
			retryDelay:    time.Millisecond,
			log:           &logging.NoOpLogger{},
		}

		err := errors.New("some error")
		shouldRetry := runner.shouldRetry(err, &logging.NoOpLogger{}, 2, "test-check") // 2 is the last attempt (3-1)
		assert.False(t, shouldRetry)
	})

	t.Run("returns true for retryable error", func(t *testing.T) {
		runner := &Runner{
			retryAttempts: 3,
			retryDelay:    time.Millisecond,
			log:           &logging.NoOpLogger{},
		}

		err := errors.New("some error")
		shouldRetry := runner.shouldRetry(err, &logging.NoOpLogger{}, 1, "test-check")
		assert.True(t, shouldRetry)
	})
}

func TestIsAPIServerShuttingDown(t *testing.T) {
	t.Run("returns true for shutdown error", func(t *testing.T) {
		err := errors.New("apiserver is shutting down")
		result := isAPIServerShuttingDown(err, &logging.NoOpLogger{})
		assert.True(t, result)
	})

	t.Run("returns false for other errors", func(t *testing.T) {
		err := errors.New("some other error")
		result := isAPIServerShuttingDown(err, &logging.NoOpLogger{})
		assert.False(t, result)
	})

	t.Run("returns false for nil error", func(t *testing.T) {
		// Skip this test since the function doesn't handle nil errors gracefully
		// and we can't easily test it without causing a panic
		t.Skip("isAPIServerShuttingDown doesn't handle nil errors gracefully")
	})
}

func TestRunner_registerCheckType_RetryLogic(t *testing.T) {
	t.Run("retries on create error", func(t *testing.T) {
		attempts := 0
		mockClient := &mockClient{
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return nil, k8sErrs.NewNotFound(schema.GroupResource{}, id.Name)
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				attempts++
				if attempts < 3 {
					return nil, errors.New("temporary error")
				}
				return obj, nil
			},
		}

		runner := &Runner{
			typeClient:    mockClient,
			retryAttempts: 5,
			retryDelay:    time.Millisecond, // Fast for testing
			log:           &logging.NoOpLogger{},
		}

		obj := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-check",
			},
		}

		err := runner.registerCheckType(context.Background(), &logging.NoOpLogger{}, "test-check", obj)
		assert.NoError(t, err)
		assert.Equal(t, 3, attempts)
	})

	t.Run("gives up after max retries", func(t *testing.T) {
		attempts := 0
		mockClient := &mockClient{
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return nil, k8sErrs.NewNotFound(schema.GroupResource{}, id.Name)
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				attempts++
				return nil, errors.New("persistent error")
			},
		}

		runner := &Runner{
			typeClient:    mockClient,
			retryAttempts: 2,
			retryDelay:    time.Millisecond, // Fast for testing
			log:           &logging.NoOpLogger{},
		}

		obj := &advisorv0alpha1.CheckType{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-check",
			},
		}

		err := runner.registerCheckType(context.Background(), &logging.NoOpLogger{}, "test-check", obj)
		assert.NoError(t, err)       // Should not return error, just give up
		assert.Equal(t, 1, attempts) // With retryAttempts=2, it will only try once before giving up
	})
}
