package app

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/stretchr/testify/assert"
)

func TestGetCheck(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetLabels(map[string]string{checks.TypeLabel: "testType"})

	checkMap := map[string]checks.Check{
		"testType": &mockCheck{},
	}

	check, err := getCheck(obj, checkMap)
	assert.NoError(t, err)
	assert.NotNil(t, check)
}

func TestGetCheck_MissingLabel(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	checkMap := map[string]checks.Check{}

	_, err := getCheck(obj, checkMap)
	assert.Error(t, err)
	assert.Equal(t, "missing check type as label", err.Error())
}

func TestGetCheck_UnknownType(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetLabels(map[string]string{checks.TypeLabel: "unknownType"})

	checkMap := map[string]checks.Check{
		"testType": &mockCheck{},
	}

	_, err := getCheck(obj, checkMap)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown check type unknownType")
}

func TestProcessCheck(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{}
	ctx := context.TODO()
	check := &mockCheck{
		items: []any{"item"},
	}

	err = processCheck(ctx, client, obj, check)
	assert.NoError(t, err)
	assert.Equal(t, "processed", obj.GetAnnotations()[checks.StatusAnnotation])
}

func TestProcessMultipleCheckItems(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{}
	ctx := context.TODO()
	items := make([]any, 100)
	for i := range items {
		if i%2 == 0 {
			items[i] = fmt.Sprintf("item-%d", i)
		} else {
			items[i] = errors.New("error")
		}
	}
	check := &mockCheck{
		items: items,
	}

	err = processCheck(ctx, client, obj, check)
	assert.NoError(t, err)
	assert.Equal(t, "processed", obj.GetAnnotations()[checks.StatusAnnotation])
	r := client.lastValue.(advisorv0alpha1.CheckReport)
	assert.Equal(t, r.Count, int64(100))
	assert.Len(t, r.Failures, 50)
}

func TestProcessCheck_AlreadyProcessed(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{checks.StatusAnnotation: "processed"})
	client := &mockClient{}
	ctx := context.TODO()
	check := &mockCheck{}

	err := processCheck(ctx, client, obj, check)
	assert.NoError(t, err)
}

func TestProcessCheck_RunError(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		t.Fatal(err)
	}
	meta.SetCreatedBy("user:1")
	client := &mockClient{}
	ctx := context.TODO()

	check := &mockCheck{
		items: []any{"item"},
		err:   errors.New("run error"),
	}

	err = processCheck(ctx, client, obj, check)
	assert.Error(t, err)
	assert.Equal(t, "error", obj.GetAnnotations()[checks.StatusAnnotation])
}

type mockClient struct {
	resource.Client
	lastValue any
}

func (m *mockClient) PatchInto(ctx context.Context, id resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions, obj resource.Object) error {
	m.lastValue = req.Operations[0].Value
	return nil
}

type mockCheck struct {
	err   error
	items []any
}

func (m *mockCheck) ID() string {
	return "mock"
}

func (m *mockCheck) Items(ctx context.Context) ([]any, error) {
	return m.items, nil
}

func (m *mockCheck) Steps() []checks.Step {
	return []checks.Step{
		&mockStep{err: m.err},
	}
}

type mockStep struct {
	err error
}

func (m *mockStep) Run(ctx context.Context, obj *advisorv0alpha1.CheckSpec, items any) (*advisorv0alpha1.CheckReportFailure, error) {
	if m.err != nil {
		return nil, m.err
	}
	if _, ok := items.(error); ok {
		return &advisorv0alpha1.CheckReportFailure{}, nil
	}
	return nil, nil
}

func (m *mockStep) Title() string {
	return "mock"
}

func (m *mockStep) Description() string {
	return "mock"
}

func (m *mockStep) Resolution() string {
	return "mock"
}

func (m *mockStep) ID() string {
	return "mock"
}
