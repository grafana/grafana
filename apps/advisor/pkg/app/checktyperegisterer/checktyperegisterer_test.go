package checktyperegisterer

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	k8sErrs "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestCheckTypesRegisterer_Run(t *testing.T) {
	tests := []struct {
		name        string
		checks      []checks.Check
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
					createFunc: tt.createFunc,
					updateFunc: tt.updateFunc,
				},
				namespace: "custom-namespace",
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

func (m *mockStep) Run(ctx context.Context, obj *advisorv0alpha1.CheckSpec, item any) (*advisorv0alpha1.CheckReportFailure, error) {
	return nil, nil
}

type mockClient struct {
	resource.Client

	createFunc func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error)
	updateFunc func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error)
}

func (m *mockClient) Create(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
	return m.createFunc(ctx, id, obj, opts)
}

func (m *mockClient) Update(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
	return m.updateFunc(ctx, id, obj, opts)
}
