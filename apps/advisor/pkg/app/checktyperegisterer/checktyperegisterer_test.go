package checktyperegisterer

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	k8sErrs "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestCheckTypesRegisterer_Run(t *testing.T) {
	tests := []struct {
		name        string
		checks      []checks.Check
		getFunc     func(ctx context.Context, id resource.Identifier) (resource.Object, error)
		createFunc  func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error)
		updateFunc  func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error)
		expectedErr error
	}{
		{
			name: "successful create",
			checks: []checks.Check{
				&mockCheck{
					id: "check1",
					steps: []checks.Step{
						&mockStep{id: "step1", title: "Step 1", description: "Description 1"},
					},
				},
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				return obj, nil
			},
			updateFunc:  nil,
			expectedErr: nil,
		},
		{
			name: "create already exists, successful update",
			checks: []checks.Check{
				&mockCheck{
					id: "check1",
					steps: []checks.Step{
						&mockStep{id: "step1", title: "Step 1", description: "Description 1"},
					},
				},
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				return nil, k8sErrs.NewAlreadyExists(schema.GroupResource{}, obj.GetName())
			},
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				return obj, nil
			},
			expectedErr: nil,
		},
		{
			name: "create already exists, with custom annotations",
			checks: []checks.Check{
				&mockCheck{
					id: "check1",
					steps: []checks.Step{
						&mockStep{id: "step1", title: "Step 1", description: "Description 1"},
					},
				},
			},
			getFunc: func(ctx context.Context, id resource.Identifier) (resource.Object, error) {
				return &advisorv0alpha1.CheckType{
					ObjectMeta: metav1.ObjectMeta{
						Name: "check1",
						Annotations: map[string]string{
							checks.IgnoreStepsAnnotationList: "step1",
						},
					},
				}, nil
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				return nil, k8sErrs.NewAlreadyExists(schema.GroupResource{}, obj.GetName())
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
			name: "create error",
			checks: []checks.Check{
				&mockCheck{
					id: "check1",
					steps: []checks.Step{
						&mockStep{id: "step1", title: "Step 1", description: "Description 1"},
					},
				},
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				return nil, errors.New("create error")
			},
			updateFunc:  nil,
			expectedErr: errors.New("create error"),
		},
		{
			name: "update error",
			checks: []checks.Check{
				&mockCheck{
					id: "check1",
					steps: []checks.Step{
						&mockStep{id: "step1", title: "Step 1", description: "Description 1"},
					},
				},
			},
			createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
				return nil, k8sErrs.NewAlreadyExists(schema.GroupResource{}, obj.GetName())
			},
			updateFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
				return nil, errors.New("update error")
			},
			expectedErr: errors.New("update error"),
		},
		{
			name: "custom namespace",
			checks: []checks.Check{
				&mockCheck{
					id: "check1",
					steps: []checks.Step{
						&mockStep{id: "step1", title: "Step 1", description: "Description 1"},
					},
				},
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
				client: &mockClient{
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
	return advisorv0alpha1.CheckTypeKind().ZeroValue(), nil
}

func (m *mockClient) Create(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
	return m.createFunc(ctx, id, obj, opts)
}

func (m *mockClient) Update(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
	return m.updateFunc(ctx, id, obj, opts)
}
