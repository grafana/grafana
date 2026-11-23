package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
)

func TestVariableSpecOf(t *testing.T) {
	t.Run("v2 spec is returned as is", func(t *testing.T) {
		v := newCustomVariableV2("region", "region")
		spec, err := variableSpecOf(v)
		require.NoError(t, err)
		require.Equal(t, v.Spec, spec)
	})

	t.Run("v2beta1 spec is converted to v2", func(t *testing.T) {
		in := newCustomVariable("region", "region")
		in.Spec.CustomVariableKind.Spec.Query = "eu,us"
		spec, err := variableSpecOf(in)
		require.NoError(t, err)
		require.NotNil(t, spec.CustomVariableKind)
		require.Equal(t, "region", getVariableName(spec))
		require.Equal(t, "eu,us", spec.CustomVariableKind.Spec.Query)
	})

	t.Run("nil variables are rejected", func(t *testing.T) {
		for _, obj := range []runtime.Object{(*dashv2.Variable)(nil), (*dashv2beta1.Variable)(nil)} {
			_, err := variableSpecOf(obj)
			require.ErrorIs(t, err, errVariablePayloadRequired)
		}
	})

	t.Run("other kinds are rejected", func(t *testing.T) {
		_, err := variableSpecOf(&dashv2.Dashboard{})
		require.ErrorContains(t, err, "unsupported variable version")
	})
}

func TestVariableGetAttrs(t *testing.T) {
	v2 := newCustomVariableV2("region", "region--folder-a")
	v2beta1 := newCustomVariable("region", "region--folder-a")
	for _, obj := range []runtime.Object{v2, v2beta1} {
		accessor, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		accessor.SetNamespace("stacks-1")
		accessor.SetLabels(map[string]string{variableFolderLabelKey: "folder-a"})

		labels, fields, err := VariableGetAttrs(obj)
		require.NoError(t, err)
		require.Equal(t, "folder-a", labels[variableFolderLabelKey])
		require.Equal(t, "region", fields["spec.spec.name"])
		require.Equal(t, "region--folder-a", fields["metadata.name"])
		require.Equal(t, "stacks-1", fields["metadata.namespace"])
	}

	_, _, err := VariableGetAttrs(&dashv2.Dashboard{})
	require.Error(t, err)
}

func TestDashboardsAPIBuilderValidateV2Variable(t *testing.T) {
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)
	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				ActionVariablesCreate: {generalScope},
				ActionVariablesWrite:  {generalScope},
			},
		},
	})
	builder := &DashboardsAPIBuilder{
		accessControl:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
	}

	t.Run("create is admitted", func(t *testing.T) {
		v := newCustomVariableV2("region", "region")
		require.NoError(t, builder.Validate(ctx, buildV2VariableAttributesForOp(admission.Create, v, nil), nil))
	})

	t.Run("invalid spec is rejected", func(t *testing.T) {
		v := newCustomVariableV2("__region", "")
		err := builder.Validate(ctx, buildV2VariableAttributesForOp(admission.Create, v, nil), nil)
		require.True(t, apierrors.IsBadRequest(err))
		require.ErrorContains(t, err, "must not start with '__'")
	})

	t.Run("explicit name must match derived value", func(t *testing.T) {
		v := newCustomVariableV2("region", "region")
		v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})
		err := builder.Validate(ctx, buildV2VariableAttributesForOp(admission.Create, v, nil), nil)
		require.True(t, apierrors.IsBadRequest(err))
		require.ErrorContains(t, err, `expected "region--folder-a"`)
	})

	t.Run("update is admitted", func(t *testing.T) {
		v := newCustomVariableV2("region", "region")
		require.NoError(t, builder.Validate(ctx, buildV2VariableAttributesForOp(admission.Update, v, newCustomVariableV2("region", "region")), nil))
	})

	t.Run("rename is rejected", func(t *testing.T) {
		err := builder.Validate(ctx, buildV2VariableAttributesForOp(admission.Update,
			newCustomVariableV2("status", "region"), newCustomVariableV2("region", "region")), nil)
		require.True(t, apierrors.IsBadRequest(err))
		require.ErrorContains(t, err, "spec.spec.name cannot be changed")
	})

	t.Run("folder scope change is rejected", func(t *testing.T) {
		newVariable := newCustomVariableV2("region", "region")
		newVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})
		err := builder.Validate(ctx, buildV2VariableAttributesForOp(admission.Update, newVariable, newCustomVariableV2("region", "region")), nil)
		require.True(t, apierrors.IsBadRequest(err))
		require.ErrorContains(t, err, "folder scope cannot be changed")
	})

	t.Run("delete without permission is forbidden", func(t *testing.T) {
		err := builder.Validate(ctx, buildV2VariableAttributesForOp(admission.Delete, nil, newCustomVariableV2("region", "region")), nil)
		require.True(t, apierrors.IsForbidden(err))
	})
}

func TestDashboardsAPIBuilderMutateV2Variable(t *testing.T) {
	builder := &DashboardsAPIBuilder{}

	v := newCustomVariableV2("status", "")
	v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-z"})
	require.NoError(t, builder.Mutate(context.Background(), buildV2VariableAttributesForOp(admission.Create, v, nil), nil))
	require.Equal(t, "status--folder-z", v.GetName())
	require.Equal(t, "folder-z", v.GetLabels()[variableFolderLabelKey])

	v.SetAnnotations(map[string]string{})
	require.NoError(t, builder.Mutate(context.Background(), buildV2VariableAttributesForOp(admission.Update, v, nil), nil))
	require.NotContains(t, v.GetLabels(), variableFolderLabelKey)
	require.Equal(t, "status--folder-z", v.GetName())
}
