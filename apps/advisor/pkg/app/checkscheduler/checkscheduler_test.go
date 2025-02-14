package checkscheduler

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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

func TestRunner_cleanupChecks_ErrorOnList(t *testing.T) {
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			return nil, errors.New("list error")
		},
	}

	runner := &Runner{
		client: mockClient,
	}

	err := runner.cleanupChecks(context.Background())
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
	}

	err := runner.cleanupChecks(context.Background())
	assert.NoError(t, err)
}

func TestRunner_cleanupChecks_ErrorOnDelete(t *testing.T) {
	mockClient := &MockClient{
		listFunc: func(ctx context.Context, namespace string, options resource.ListOptions) (resource.ListObject, error) {
			items := make([]advisorv0alpha1.Check, 0, defaultMaxHistory+1)
			for i := 0; i < defaultMaxHistory+1; i++ {
				item := advisorv0alpha1.Check{}
				item.ObjectMeta.SetLabels(map[string]string{
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
	}
	err := runner.cleanupChecks(context.Background())
	assert.ErrorContains(t, err, "delete error")
}

func TestRunner_cleanupChecks_Success(t *testing.T) {
	itemsDeleted := []string{}
	items := make([]advisorv0alpha1.Check, 0, defaultMaxHistory+1)
	for i := 0; i < defaultMaxHistory+1; i++ {
		item := advisorv0alpha1.Check{}
		item.ObjectMeta.SetName(fmt.Sprintf("check-%d", i))
		item.ObjectMeta.SetLabels(map[string]string{
			checks.TypeLabel: "mock",
		})
		item.ObjectMeta.SetCreationTimestamp(metav1.NewTime(time.Time{}.Add(time.Duration(i) * time.Hour)))
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
	}
	err := runner.cleanupChecks(context.Background())
	assert.NoError(t, err)
	assert.Equal(t, []string{"check-0"}, itemsDeleted)
}

func Test_getEvaluationInterval(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		interval, err := getEvaluationInterval(map[string]string{})
		assert.NoError(t, err)
		assert.Equal(t, 24*time.Hour, interval)
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
	deleteFunc func(ctx context.Context, identifier resource.Identifier, options resource.DeleteOptions) error
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
