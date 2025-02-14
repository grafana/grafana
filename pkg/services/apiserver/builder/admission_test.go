package builder_test

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/apis/example"
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
			b := builder.NewAdmission(nil, tt.validators)
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

func TestBuilderAdmission_Admit(t *testing.T) {
	gvk := schema.GroupVersionKind{
		Group:   "test.grafana.app",
		Version: "v1",
		Kind:    "Foo",
	}
	gvr := gvk.GroupVersion().WithResource("foos")
	exampleObj := &example.Pod{ObjectMeta: metav1.ObjectMeta{Name: "foo"}, Spec: example.PodSpec{}}
	tests := []struct {
		name       string
		mutators   map[schema.GroupVersion]builder.APIGroupMutation
		attributes admission.Attributes
		wantErr    bool
		wantSpec   example.PodSpec
	}{
		{
			name: "mutator exists - error",
			mutators: map[schema.GroupVersion]builder.APIGroupMutation{
				gvk.GroupVersion(): &mockMutator{
					mutateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
						return errors.New("test error")
					},
				},
			},
			attributes: admission.NewAttributesRecord(exampleObj.DeepCopy(), nil, gvk, "default", "foo", gvr, "", admission.Create, nil, false, nil),
			wantErr:    true,
			wantSpec:   exampleObj.Spec,
		},
		{
			name: "mutator exists - add hostname",
			mutators: map[schema.GroupVersion]builder.APIGroupMutation{
				gvk.GroupVersion(): &mockMutator{
					mutateFunc: func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
						obj := a.GetObject().(*example.Pod)
						obj.Spec.Hostname = "test"
						return nil
					},
				},
			},
			attributes: admission.NewAttributesRecord(exampleObj.DeepCopy(), nil, gvk, "default", "foo", gvr, "", admission.Create, nil, false, nil),
			wantErr:    false,
			wantSpec:   example.PodSpec{Hostname: "test"},
		},
		{
			name:       "mutator does not exist",
			mutators:   map[schema.GroupVersion]builder.APIGroupMutation{},
			attributes: admission.NewAttributesRecord(exampleObj.DeepCopy(), nil, gvk, "default", "foo", gvr, "", admission.Create, nil, false, nil),
			wantErr:    false,
			wantSpec:   exampleObj.Spec,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := builder.NewAdmission(tt.mutators, nil)
			err := b.Admit(context.Background(), tt.attributes, nil)
			if tt.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tt.wantSpec, tt.attributes.GetObject().(*example.Pod).Spec)
		})
	}
}

type mockBuilder struct {
	builder.APIGroupBuilder
	groupVersion schema.GroupVersion
	validator    builder.APIGroupValidation
}

func (m *mockBuilder) GetGroupVersions() []schema.GroupVersion {
	return []schema.GroupVersion{m.groupVersion}
}

func (m *mockBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return m.validator.Validate(ctx, a, o)
}

type mockMutator struct {
	mutateFunc func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error
}

func (m *mockMutator) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return m.mutateFunc(ctx, a, o)
}

type mockValidator struct {
	validateFunc func(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error
}

func (m *mockValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return m.validateFunc(ctx, a, o)
}
