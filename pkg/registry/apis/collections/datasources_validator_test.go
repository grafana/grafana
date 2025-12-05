package collections_test

import (
	"context"
	"testing"

	collectionsv1alpha1 "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	queryv0alpha1 "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/collections"
	datasourcesclient "github.com/grafana/grafana/pkg/services/datasources/service/client"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
)

func TestDataSourceValidator_Validate(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name                string
		operation           admission.Operation
		object              runtime.Object
		needMockDSClient    bool // only set to true if you expect to make a call to the datasource client
		dsClientReturnValue *queryv0alpha1.DataSourceConnection
		dsClientReturnError error
		expectError         bool
		errorMsg            string
	}{
		{
			name:        "should return no error for invalid kind",
			operation:   admission.Delete,
			object:      &collectionsv1alpha1.Stars{},
			expectError: false,
		},
		{
			name:        "should return error for Connect operation",
			operation:   admission.Connect,
			object:      &collectionsv1alpha1.DataSourceStack{},
			expectError: true,
		},
		{
			name:      "template items cannot be empty",
			operation: admission.Create,
			object: &collectionsv1alpha1.DataSourceStack{
				Spec: collectionsv1alpha1.DataSourceStackSpec{
					Template: collectionsv1alpha1.DataSourceStackTemplateSpec{
						"key1": collectionsv1alpha1.DataSourceStackDataSourceStackTemplateItem{},
					},
				},
			},
			expectError: true,
			errorMsg:    "template items cannot be empty (test-datasourcestack collections.grafana.app/v1alpha1)",
		},
		{
			name:      "template item name keys must be unique",
			operation: admission.Create,
			object: &collectionsv1alpha1.DataSourceStack{
				Spec: collectionsv1alpha1.DataSourceStackSpec{
					Template: collectionsv1alpha1.DataSourceStackTemplateSpec{
						"key1": collectionsv1alpha1.DataSourceStackDataSourceStackTemplateItem{
							Name:  "foo",
							Group: "foo.grafana",
						},
						"key2": collectionsv1alpha1.DataSourceStackDataSourceStackTemplateItem{
							Name:  "foo",
							Group: "foo.grafana",
						},
					},
				},
			},
			expectError: true,
			errorMsg:    "template item names must be unique. name 'foo' already exists (test-datasourcestack collections.grafana.app/v1alpha1)",
		},
		{
			name:      "mode keys must exist in the template",
			operation: admission.Create,
			object: &collectionsv1alpha1.DataSourceStack{
				Spec: collectionsv1alpha1.DataSourceStackSpec{
					Template: collectionsv1alpha1.DataSourceStackTemplateSpec{
						"key1": collectionsv1alpha1.DataSourceStackDataSourceStackTemplateItem{
							Name:  "foo",
							Group: "foo.grafana",
						},
					},
					Modes: []collectionsv1alpha1.DataSourceStackModeSpec{
						{
							Name: "prod",
							Definition: collectionsv1alpha1.DataSourceStackMode{
								"notintemplate": collectionsv1alpha1.DataSourceStackModeItem{
									DataSourceRef: "foo",
								},
							},
						},
					},
				},
			},
			expectError: true,
			errorMsg:    "key 'notintemplate' is not in the DataSourceStack template (test-datasourcestack collections.grafana.app/v1alpha1)",
		},
		{
			name:      "error if data source does not exist",
			operation: admission.Create,
			object: &collectionsv1alpha1.DataSourceStack{
				Spec: collectionsv1alpha1.DataSourceStackSpec{
					Template: collectionsv1alpha1.DataSourceStackTemplateSpec{
						"key1": collectionsv1alpha1.DataSourceStackDataSourceStackTemplateItem{
							Name:  "foo",
							Group: "foo.grafana",
						},
					},
					Modes: []collectionsv1alpha1.DataSourceStackModeSpec{
						{
							Name: "prod",
							Definition: collectionsv1alpha1.DataSourceStackMode{
								"key1": collectionsv1alpha1.DataSourceStackModeItem{
									DataSourceRef: "ref",
								},
							},
						},
					},
				},
			},
			needMockDSClient:    true,
			dsClientReturnValue: nil, // no result - this is the default anyway
			expectError:         true,
			errorMsg:            "datasource 'ref' in group 'foo.grafana' does not exist (test-datasourcestack collections.grafana.app/v1alpha1)",
		},
		{
			name:      "valid request",
			operation: admission.Create,
			object: &collectionsv1alpha1.DataSourceStack{
				Spec: collectionsv1alpha1.DataSourceStackSpec{
					Template: collectionsv1alpha1.DataSourceStackTemplateSpec{
						"key1": collectionsv1alpha1.DataSourceStackDataSourceStackTemplateItem{
							Name:  "foo",
							Group: "foo.grafana",
						},
					},
					Modes: []collectionsv1alpha1.DataSourceStackModeSpec{
						{
							Name: "prod",
							Definition: collectionsv1alpha1.DataSourceStackMode{
								"key1": collectionsv1alpha1.DataSourceStackModeItem{
									DataSourceRef: "ref",
								},
							},
						},
					},
				},
			},
			needMockDSClient:    true,
			dsClientReturnValue: &queryv0alpha1.DataSourceConnection{}, // returning any non-nil value will pass validation
			expectError:         false,
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

			var client *datasourcesclient.MockDataSourceConnectionClient
			if tt.needMockDSClient {
				client = datasourcesclient.NewMockDataSourceConnectionClient(t)
				client.On("GetByUID", mock.Anything, mock.Anything).Return(tt.dsClientReturnValue, tt.dsClientReturnError)
			}

			validator := collections.GetDatasourceStacksValidator(client)
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
