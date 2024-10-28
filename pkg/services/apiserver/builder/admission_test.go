package builder_test

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
)

func TestBuilderAdmission_Validate(t *testing.T) {
	gvk := schema.GroupVersionKind{
		Group:   "example.grafana.app",
		Version: "v1",
		Kind:    "Foo",
	}
	gvr := gvk.GroupVersion().WithResource("foos")
	defaultAttributes := admission.NewAttributesRecord(nil, nil, gvk, "default", "foo", gvr, "", admission.Create, nil, false, nil)
	tests := []struct {
		name       string
		validators map[schema.GroupVersion]builder.APIGroupValidation
		attributes admission.Attributes
		wantErr    bool
	}{
		{
			name: "validator exists - forbidden",
			validators: map[schema.GroupVersion]builder.APIGroupValidation{
				gvk.GroupVersion(): &mockValidator{
					validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
						return admission.NewForbidden(a, errors.New("test error"))
					},
				},
			},
			attributes: defaultAttributes,
			wantErr:    true,
		},
		{
			name: "validator exists - allowed",
			validators: map[schema.GroupVersion]builder.APIGroupValidation{
				gvk.GroupVersion(): &mockValidator{
					validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
						return nil
					},
				},
			},
			attributes: defaultAttributes,
			wantErr:    false,
		},
		{
			name:       "validator does not exist",
			validators: map[schema.GroupVersion]builder.APIGroupValidation{},
			attributes: defaultAttributes,
			wantErr:    false,
		},
		{
			name: "multiple validators",
			validators: map[schema.GroupVersion]builder.APIGroupValidation{
				{Group: "example.grafana.app", Version: "v1beta"}: &mockValidator{
					validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
						return nil
					},
				},
				gvk.GroupVersion(): &mockValidator{
					validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
						return admission.NewForbidden(a, errors.New("test error"))
					},
				},
				{Group: "example.grafana.app", Version: "v2"}: &mockValidator{
					validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
						return nil
					},
				},
			},
			attributes: defaultAttributes,
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := builder.NewAdmission(tt.validators)
			err := b.Validate(context.Background(), tt.attributes, nil)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestNewAdmissionFromBuilders(t *testing.T) {
	gvk := schema.GroupVersionKind{
		Group:   "example.grafana.app",
		Version: "v1",
		Kind:    "Foo",
	}
	gvr := gvk.GroupVersion().WithResource("foos")
	defaultAttributes := admission.NewAttributesRecord(nil, nil, gvk, "default", "foo", gvr, "", admission.Create, nil, false, nil)

	builders := []builder.APIGroupBuilder{
		&mockBuilder{
			groupVersion: schema.GroupVersion{Group: "example.grafana.app", Version: "v1beta"},
			validator: &mockValidator{
				validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
					return nil
				},
			},
		},
		&mockBuilder{
			groupVersion: gvk.GroupVersion(),
			validator: &mockValidator{
				validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
					return admission.NewForbidden(a, errors.New("test error"))
				},
			},
		},
		&mockBuilder{
			groupVersion: schema.GroupVersion{Group: "example.grafana.app", Version: "v2"},
			validator: &mockValidator{
				validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
					return nil
				},
			},
		},
	}

	a := builder.NewAdmissionFromBuilders(builders)
	err := a.Validate(context.Background(), defaultAttributes, nil)
	require.Error(t, err)
}

type mockBuilder struct {
	builder.APIGroupBuilder
	groupVersion schema.GroupVersion
	validator    builder.APIGroupValidation
}

func (m *mockBuilder) GetGroupVersion() schema.GroupVersion {
	return m.groupVersion
}

func (m *mockBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return m.validator.Validate(ctx, a, o)
}

type mockValidator struct {
	validateFunc func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error
}

func (m *mockValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return m.validateFunc(ctx, a, o)
}
