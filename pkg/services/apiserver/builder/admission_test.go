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
		Group:   "testGroup",
		Version: "v1",
		Kind:    "testKind",
	}
	gvr := gvk.GroupVersion().WithResource("testkinds")
	defaultAttributes := admission.NewAttributesRecord(nil, nil, gvk, "", "", gvr, "", admission.Create, nil, false, nil)
	tests := []struct {
		name       string
		validators map[schema.GroupVersion]builder.APIGroupValidation
		attributes admission.Attributes
		wantErr    bool
	}{
		{
			name: "validator exists - forbidden",
			validators: map[schema.GroupVersion]builder.APIGroupValidation{
				{Group: "testGroup", Version: "v1"}: &mockValidator{
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
				{Group: "testGroup", Version: "v1"}: &mockValidator{
					validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
						return nil
					},
				},
			},
			attributes: defaultAttributes,
			wantErr:    false,
		},
		{
			name: "validator does not exist",
			validators: map[schema.GroupVersion]builder.APIGroupValidation{
				{Group: "testGroup", Version: "v1"}: &mockValidator{
					validateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
						return nil
					},
				},
			},
			attributes: defaultAttributes,
			wantErr:    false,
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

type mockValidator struct {
	validateFunc func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error
}

func (m *mockValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return m.validateFunc(ctx, a, o)
}
