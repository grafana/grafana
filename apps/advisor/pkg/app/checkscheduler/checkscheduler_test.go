package checkscheduler

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/stretchr/testify/assert"
)

type MockCheckService struct {
	checks []checks.Check
}

func (m *MockCheckService) Checks() []checks.Check {
	return m.checks
}

type MockClient struct {
	resource.Client
	listFunc   func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error)
	createFunc func(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.CreateOptions) (resource.Object, error)
}

func (m *MockClient) List(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
	return m.listFunc(ctx, namespace, options)
}

func (m *MockClient) Create(ctx context.Context, identifier resource.Identifier, obj resource.Object, options resource.CreateOptions) (resource.Object, error) {
	return m.createFunc(ctx, identifier, obj, options)
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

func TestRunner_Run_ErrorOnList(t *testing.T) {
	mockCheckService := &MockCheckService{}
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return nil, errors.New("list error")
		},
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			return &advisorv0alpha1.Check{}, nil
		},
	}

	runner := &Runner{
		checkRegistry: mockCheckService,
		client:        mockClient,
	}

	err := runner.Run(context.Background())
	assert.Error(t, err)
}

func TestRunner_checkLastCreated_ErrorOnList(t *testing.T) {
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return nil, errors.New("list error")
		},
	}

	runner := &Runner{
		client: mockClient,
	}

	lastCreated, err := runner.checkLastCreated(context.Background())
	assert.Error(t, err)
	assert.True(t, lastCreated.IsZero())
}

func TestRunner_createChecks_ErrorOnCreate(t *testing.T) {
	mockCheckService := &MockCheckService{
		checks: []checks.Check{
			&mockCheck{
				id: "check-1",
			},
		},
	}
	mockClient := &MockClient{
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			return nil, errors.New("create error")
		},
	}

	runner := &Runner{
		checkRegistry: mockCheckService,
		client:        mockClient,
	}

	err := runner.createChecks(context.Background())
	assert.Error(t, err)
}

func TestRunner_createChecks_Success(t *testing.T) {
	mockCheckService := &MockCheckService{
		checks: []checks.Check{
			&mockCheck{
				id: "check-1",
			},
		},
	}
	mockClient := &MockClient{
		createFunc: func(ctx context.Context, id resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
			return &advisorv0alpha1.Check{}, nil
		},
	}

	runner := &Runner{
		checkRegistry: mockCheckService,
		client:        mockClient,
	}

	err := runner.createChecks(context.Background())
	assert.NoError(t, err)
}
