package runner

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	examplev1 "github.com/grafana/grafana/pkg/services/apiserver/builder/runner/testdata/app/pkg/apis/example/v1"
)

func TestBuilderAdmission_Validate(t *testing.T) {
	exampleObj := &examplev1.Example{
		Spec: examplev1.ExampleSpec{
			A: "test",
		},
	}
	gvk := schema.GroupVersionKind{
		Group:   examplev1.ExampleKind().Group(),
		Version: examplev1.ExampleKind().Version(),
		Kind:    examplev1.ExampleKind().Kind(),
	}
	gvr := gvk.GroupVersion().WithResource(examplev1.ExampleKind().Plural())
	defaultAttributes := admission.NewAttributesRecord(exampleObj, nil, gvk, "default", "foo", gvr, "", admission.Create, nil, false, &user.DefaultInfo{})

	tests := []struct {
		name    string
		app     app.App
		req     *app.AdmissionRequest
		wantErr bool
	}{
		{
			name: "validator exists - success",
			app: &mockApp{
				validateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
					return nil
				},
			},
			wantErr: false,
		},
		{
			name: "validator exists - error",
			app: &mockApp{
				validateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
					return errors.New("error")
				},
			},
			wantErr: true,
		},
		{
			name:    "validator not set - success",
			app:     &mockApp{},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := appBuilder{app: tt.app}
			err := b.Validate(context.Background(), defaultAttributes, nil)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestBuilderAdmission_Mutate(t *testing.T) {
	gvk := schema.GroupVersionKind{
		Group:   examplev1.ExampleKind().Group(),
		Version: examplev1.ExampleKind().Version(),
		Kind:    examplev1.ExampleKind().Kind(),
	}
	gvr := gvk.GroupVersion().WithResource(examplev1.ExampleKind().Plural())
	getAttributes := func() admission.Attributes {
		exampleObj := &examplev1.Example{
			Spec: examplev1.ExampleSpec{
				A: "test",
			},
		}
		return admission.NewAttributesRecord(exampleObj, nil, gvk, "default", "foo", gvr, "", admission.Create, nil, false, &user.DefaultInfo{})
	}
	tests := []struct {
		name       string
		app        app.App
		attributes admission.Attributes
		expected   examplev1.Example
		wantErr    bool
	}{
		{
			name: "mutator exists - success",
			app: &mockApp{
				mutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
					return &app.MutatingResponse{
						UpdatedObject: &examplev1.Example{
							Spec: examplev1.ExampleSpec{
								A: "test",
								B: "mutated",
							},
						},
					}, nil
				},
			},
			attributes: getAttributes(),
			expected: examplev1.Example{
				Spec: examplev1.ExampleSpec{
					A: "test",
					B: "mutated",
				},
			},
			wantErr: false,
		},
		{
			name: "mutator exists - error",
			app: &mockApp{
				mutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
					return nil, errors.New("error")
				},
			},
			attributes: getAttributes(),
			wantErr:    true,
		},
		{
			name:       "mutator not set - no modification",
			app:        &mockApp{},
			attributes: getAttributes(),
			expected: examplev1.Example{
				Spec: examplev1.ExampleSpec{
					A: "test",
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := appBuilder{app: tt.app}
			err := b.Mutate(context.Background(), tt.attributes, nil)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, &tt.expected, tt.attributes.GetObject())
			}
		})
	}
}

type mockApp struct {
	app.App
	mutateFunc   func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error)
	validateFunc func(ctx context.Context, req *app.AdmissionRequest) error
}

func (m *mockApp) Mutate(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
	if m.mutateFunc == nil {
		return nil, app.ErrNotImplemented
	}
	return m.mutateFunc(ctx, req)
}

func (m *mockApp) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	if m.validateFunc == nil {
		return app.ErrNotImplemented
	}
	return m.validateFunc(ctx, req)
}
