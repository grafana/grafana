package app

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/stretchr/testify/assert"
)

func TestGetCheck(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetLabels(map[string]string{typeLabel: "testType"})

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
	obj.SetLabels(map[string]string{typeLabel: "unknownType"})

	checkMap := map[string]checks.Check{
		"testType": &mockCheck{},
	}

	_, err := getCheck(obj, checkMap)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unknown check type unknownType")
}

func TestSetStatusAnnotation(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{})
	client := &mockClient{}
	ctx := context.TODO()

	err := setStatusAnnotation(ctx, client, obj, "processed")
	assert.NoError(t, err)
	assert.Equal(t, "processed", obj.GetAnnotations()[statusAnnotation])
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
	check := &mockCheck{}

	err = processCheck(ctx, client, obj, check)
	assert.NoError(t, err)
	assert.Equal(t, "processed", obj.GetAnnotations()[statusAnnotation])
}

func TestProcessCheck_AlreadyProcessed(t *testing.T) {
	obj := &advisorv0alpha1.Check{}
	obj.SetAnnotations(map[string]string{statusAnnotation: "processed"})
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
		err: errors.New("run error"),
	}

	err = processCheck(ctx, client, obj, check)
	assert.Error(t, err)
	assert.Equal(t, "error", obj.GetAnnotations()[statusAnnotation])
}

type mockClient struct {
	resource.Client
}

func (m *mockClient) PatchInto(ctx context.Context, id resource.Identifier, req resource.PatchRequest, opts resource.PatchOptions, obj resource.Object) error {
	return nil
}

type mockCheck struct {
	checks.Check
	err error
}

func (m *mockCheck) Run(ctx context.Context, spec *advisorv0alpha1.CheckSpec) (*advisorv0alpha1.CheckV0alpha1StatusReport, error) {
	return &advisorv0alpha1.CheckV0alpha1StatusReport{}, m.err
}
