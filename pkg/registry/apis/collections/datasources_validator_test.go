package collections_test

import (
	"context"
	"testing"

	collectionsv1alpha1 "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/collections"
	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
)

func TestDataSourceValidator_Validate(t *testing.T) {
	validator := &collections.DatasourceStacksValidator{}
	ctx := context.Background()

	tests := []struct {
		name        string
		operation   admission.Operation
		object      runtime.Object
		expectError bool
		errorMsg    string
	}{
		{
			name:        "should return no error for invalid kind",
			operation:   admission.Delete,
			object:      &collectionsv1alpha1.Stars{},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attrs := &FakeAdmissionAttributes{
				Operation: tt.operation,
				Object:    tt.object,
				Name:      "test-datasourcestack",
				Kind:      schema.GroupVersionKind{Group: "collections.grafana.app", Version: "v1alpha1", Kind: "DataSourceStack"},
			}

			err := validator.Validate(ctx, attrs, nil)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

type FakeAdmissionAttributes struct {
	admission.Attributes
	Operation admission.Operation
	Object    runtime.Object
	Name      string
	Kind      schema.GroupVersionKind
}

func (m *FakeAdmissionAttributes) GetOperation() admission.Operation {
	return m.Operation
}

func (m *FakeAdmissionAttributes) GetObject() runtime.Object {
	return m.Object
}

func (m *FakeAdmissionAttributes) GetName() string {
	return m.Name
}

func (m *FakeAdmissionAttributes) GetKind() schema.GroupVersionKind {
	return m.Kind
}
