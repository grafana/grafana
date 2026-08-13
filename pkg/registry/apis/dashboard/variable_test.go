package dashboard

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/admission"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestValidateVariable(t *testing.T) {
	t.Run("valid custom variable", func(t *testing.T) {
		v := newCustomVariable("region", "region")
		require.NoError(t, validateVariable(v))
	})

	t.Run("metadata and spec names can differ", func(t *testing.T) {
		v := newCustomVariable("region", "env")
		require.NoError(t, validateVariable(v))
	})

	t.Run("empty variable name is rejected", func(t *testing.T) {
		v := newCustomVariable("", "")
		require.ErrorContains(t, validateVariable(v), "variable name must not be empty")
	})

	t.Run("reserved prefix is rejected", func(t *testing.T) {
		v := newCustomVariable("__region", "__region")
		require.ErrorContains(t, validateVariable(v), "must not start with '__'")
	})

	t.Run("name with spaces is rejected", func(t *testing.T) {
		v := newCustomVariable("my variable", "my-variable")
		require.ErrorContains(t, validateVariable(v), "must contain only letters, digits, and underscores")
	})

	t.Run("name with dot is rejected", func(t *testing.T) {
		v := newCustomVariable("my.var", "my-var")
		require.ErrorContains(t, validateVariable(v), "must contain only letters, digits, and underscores")
	})

	t.Run("multiple variable kinds are rejected", func(t *testing.T) {
		v := newCustomVariable("region", "region")
		queryVariable := dashv2beta1.NewDashboardQueryVariableKind()
		queryVariable.Spec.Name = "region"
		v.Spec.QueryVariableKind = queryVariable

		require.ErrorContains(t, validateVariable(v), "exactly one variable kind")
	})
}

func TestDashboardsAPIBuilderValidateVariable(t *testing.T) {
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)
	builder := &DashboardsAPIBuilder{accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures())}
	v := newCustomVariable("region", "region")
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {ActionVariablesCreate: {generalScope}},
		},
	})

	err := builder.Validate(ctx, admission.NewAttributesRecord(
		v,
		nil,
		dashv2beta1.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2beta1.VariableResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		false,
		nil,
	), nil)

	require.NoError(t, err)
}

func TestDashboardsAPIBuilderValidateVariableCreateRequiresFolderPermission(t *testing.T) {
	folderUID := "folder-a"
	v := newCustomVariable("region", "")
	v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgID: 1,
		// Root create only — not enough for folder-a.
		Permissions: map[int64]map[string][]string{
			1: {ActionVariablesCreate: {generalScope}},
		},
	})

	builder := &DashboardsAPIBuilder{
		accessControl:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
	}

	err := builder.Validate(ctx, admission.NewAttributesRecord(
		v,
		nil,
		dashv2beta1.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2beta1.VariableResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		false,
		nil,
	), nil)

	require.Error(t, err)
	require.True(t, apierrors.IsForbidden(err))
}

func TestDashboardsAPIBuilderValidateVariableCreateMissingFolderHandlerReturnsError(t *testing.T) {
	folderUID := "folder-a"
	v := newCustomVariable("region", "")
	v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	folderScope := folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID)

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {ActionVariablesCreate: {folderScope}},
		},
	})

	builder := &DashboardsAPIBuilder{
		accessControl:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		folderClientProvider: &staticHandlerProvider{},
	}

	err := builder.Validate(ctx, admission.NewAttributesRecord(
		v,
		nil,
		dashv2beta1.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2beta1.VariableResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		false,
		nil,
	), nil)

	require.Error(t, err)
	require.Contains(t, err.Error(), "folder client handler is not configured")
}

func TestDashboardsAPIBuilderValidateVariableCreateMetadataNameContract(t *testing.T) {
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {ActionVariablesCreate: {generalScope, folder.ScopeFoldersAll}},
		},
	})
	builder := &DashboardsAPIBuilder{accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures())}

	t.Run("name may be omitted and derived during mutation", func(t *testing.T) {
		v := newCustomVariable("status", "")

		err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Create, v, nil), nil)
		require.NoError(t, err)
	})

	t.Run("explicit name must match derived value", func(t *testing.T) {
		v := newCustomVariable("status", "status5")
		v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "abcdef"})

		err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Create, v, nil), nil)
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err))
		require.Contains(t, err.Error(), `expected "status--abcdef"`)
	})
}

func TestDashboardsAPIBuilderValidateVariableUpdateScopeChangeRejected(t *testing.T) {
	oldVariable := newCustomVariable("region", "region")
	newVariable := newCustomVariable("region", "region")
	newVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
	}

	err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Update, newVariable, oldVariable), nil)

	require.Error(t, err)
	require.True(t, apierrors.IsBadRequest(err))
	require.Contains(t, err.Error(), "folder scope cannot be changed")
}

func TestDashboardsAPIBuilderValidateVariableUpdateScopeChangeToGlobalRejected(t *testing.T) {
	oldVariable := newCustomVariable("region", "region")
	oldVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})
	newVariable := newCustomVariable("region", "region")

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
	}

	err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Update, newVariable, oldVariable), nil)

	require.Error(t, err)
	require.True(t, apierrors.IsBadRequest(err))
	require.Contains(t, err.Error(), "folder scope cannot be changed")
}

func TestDashboardsAPIBuilderValidateVariableUpdateRenameRejected(t *testing.T) {
	oldVariable := newCustomVariable("region", "region")
	newVariable := newCustomVariable("status", "region")

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgRole: identity.RoleEditor,
		OrgID:   1,
	})

	builder := &DashboardsAPIBuilder{
		folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
	}

	err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Update, newVariable, oldVariable), nil)

	require.Error(t, err)
	require.True(t, apierrors.IsBadRequest(err))
	require.Contains(t, err.Error(), "spec.spec.name cannot be changed")
}

func TestVariableMutationPermissionsStackWide(t *testing.T) {
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	builder := &DashboardsAPIBuilder{accessControl: ac}
	oldVariable := newCustomVariable("region", "region")
	newVariable := newCustomVariable("region", "region")
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)

	tests := []struct {
		name     string
		perms    map[string][]string
		op       admission.Operation
		expected bool
	}{
		{name: "root writer can create global", perms: map[string][]string{ActionVariablesCreate: {generalScope}}, op: admission.Create, expected: true},
		{name: "all-folders writer can create global", perms: map[string][]string{ActionVariablesCreate: {folder.ScopeFoldersAll}}, op: admission.Create, expected: true},
		{name: "reader cannot create global", perms: map[string][]string{ActionVariablesRead: {generalScope}}, op: admission.Create, expected: false},
		{name: "no perms cannot create global", perms: map[string][]string{}, op: admission.Create, expected: false},
		{name: "root writer can update global", perms: map[string][]string{ActionVariablesWrite: {generalScope}}, op: admission.Update, expected: true},
		{name: "reader cannot update global", perms: map[string][]string{ActionVariablesRead: {generalScope}}, op: admission.Update, expected: false},
		{name: "root writer can delete global", perms: map[string][]string{ActionVariablesDelete: {generalScope}}, op: admission.Delete, expected: true},
		{name: "reader cannot delete global", perms: map[string][]string{ActionVariablesRead: {generalScope}}, op: admission.Delete, expected: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: tc.perms,
				},
			})
			attrs := buildVariableAttributesForOp(tc.op, newVariable, oldVariable)

			err := builder.Validate(ctx, attrs, nil)
			if tc.expected {
				require.NoError(t, err)
				return
			}

			require.Error(t, err)
			require.True(t, apierrors.IsForbidden(err))
		})
	}
}

func TestVariableMutationPermissionsFolderScoped(t *testing.T) {
	folderUID := "folder-a"
	oldVariable := newCustomVariable("region", "region--folder-a")
	oldVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	newVariable := newCustomVariable("region", "region--folder-a")
	newVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	folderScope := folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID)
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)

	tests := []struct {
		name     string
		perms    map[string][]string
		op       admission.Operation
		expected bool
	}{
		{name: "folder create grant can create", perms: map[string][]string{ActionVariablesCreate: {folderScope}}, op: admission.Create, expected: true},
		{name: "folder write grant can update", perms: map[string][]string{ActionVariablesWrite: {folderScope}}, op: admission.Update, expected: true},
		{name: "folder delete grant can delete", perms: map[string][]string{ActionVariablesDelete: {folderScope}}, op: admission.Delete, expected: true},
		{name: "root-only create cannot create in folder", perms: map[string][]string{ActionVariablesCreate: {generalScope}}, op: admission.Create, expected: false},
		{name: "root-only write cannot update in folder", perms: map[string][]string{ActionVariablesWrite: {generalScope}}, op: admission.Update, expected: false},
		{name: "read-only cannot create in folder", perms: map[string][]string{ActionVariablesRead: {folderScope}}, op: admission.Create, expected: false},
		{name: "all-folders create can create", perms: map[string][]string{ActionVariablesCreate: {folder.ScopeFoldersAll}}, op: admission.Create, expected: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			folderHandler := &variableFolderAccessHandler{}
			builder := &DashboardsAPIBuilder{
				accessControl:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
				folderClientProvider: &staticHandlerProvider{handler: folderHandler},
			}

			ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
			ctx = identity.WithRequester(ctx, &identity.StaticRequester{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: tc.perms,
				},
			})
			attrs := buildVariableAttributesForOp(tc.op, newVariable, oldVariable)

			err := builder.Validate(ctx, attrs, nil)
			if tc.expected {
				require.NoError(t, err)
				return
			}

			require.Error(t, err)
			require.True(t, apierrors.IsForbidden(err))
		})
	}
}

func TestVariableMutationPermissionsFolderScopedDryRun(t *testing.T) {
	folderUID := "folder-a"
	v := newCustomVariable("region", "region--folder-a")
	v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	folderScope := folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID)

	t.Run("dry-run still checks variables:create on folder", func(t *testing.T) {
		builder := &DashboardsAPIBuilder{
			accessControl:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
			folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
		}
		ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
		ctx = identity.WithRequester(ctx, &identity.StaticRequester{
			OrgID: 1,
			Permissions: map[int64]map[string][]string{
				1: {ActionVariablesRead: {folderScope}},
			},
		})

		err := builder.Validate(ctx, admission.NewAttributesRecord(
			v,
			nil,
			dashv2beta1.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			v.GetName(),
			dashv2beta1.VariableResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			true, // dry-run
			nil,
		), nil)

		require.Error(t, err)
		require.True(t, apierrors.IsForbidden(err))
	})

	t.Run("dry-run allows create with folder grant", func(t *testing.T) {
		builder := &DashboardsAPIBuilder{
			accessControl:        acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
			folderClientProvider: &staticHandlerProvider{handler: &variableFolderAccessHandler{}},
		}
		ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
		ctx = identity.WithRequester(ctx, &identity.StaticRequester{
			OrgID: 1,
			Permissions: map[int64]map[string][]string{
				1: {ActionVariablesCreate: {folderScope}},
			},
		})

		err := builder.Validate(ctx, admission.NewAttributesRecord(
			v,
			nil,
			dashv2beta1.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			v.GetName(),
			dashv2beta1.VariableResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			true, // dry-run
			nil,
		), nil)

		require.NoError(t, err)
	})
}

func TestVariableMutationPermissionsMissingFolder(t *testing.T) {
	folderUID := "missing-folder"
	oldVariable := newCustomVariable("region", "region--missing-folder")
	oldVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	newVariable := newCustomVariable("region", "region--missing-folder")
	newVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	generalScope := folder.ScopeFoldersProvider.GetResourceScopeUID(accesscontrol.GeneralFolderUID)

	otherFolderScope := folder.ScopeFoldersProvider.GetResourceScopeUID("other-folder")

	tests := []struct {
		name     string
		perms    map[string][]string
		op       admission.Operation
		expected bool
	}{
		{name: "root delete grant can delete orphaned folder variable", perms: map[string][]string{ActionVariablesDelete: {generalScope}}, op: admission.Delete, expected: true},
		{name: "all-folders write can update orphaned folder variable", perms: map[string][]string{ActionVariablesWrite: {folder.ScopeFoldersAll}}, op: admission.Update, expected: true},
		{name: "other-folder write cannot update orphaned folder variable", perms: map[string][]string{ActionVariablesWrite: {otherFolderScope}}, op: admission.Update, expected: false},
		{name: "other-folder delete cannot delete orphaned folder variable", perms: map[string][]string{ActionVariablesDelete: {otherFolderScope}}, op: admission.Delete, expected: false},
		{name: "read-only cannot delete orphaned folder variable", perms: map[string][]string{ActionVariablesRead: {generalScope}}, op: admission.Delete, expected: false},
		{name: "root create cannot create into missing folder", perms: map[string][]string{ActionVariablesCreate: {generalScope}}, op: admission.Create, expected: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Production registers FolderUIDScopeResolver; without it, Evaluate never
			// errors on a missing folder and the general-scope orphan path is untested.
			acSvc := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
			folderSvc := foldertest.NewFakeService()
			folderSvc.ExpectedError = folder.ErrFolderNotFound
			acSvc.RegisterScopeAttributeResolver(folder.NewFolderUIDScopeResolver(folderSvc))

			folderHandler := &variableFolderAccessHandler{notFoundAccessSubresource: true}
			builder := &DashboardsAPIBuilder{
				accessControl:        acSvc,
				folderClientProvider: &staticHandlerProvider{handler: folderHandler},
			}

			ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
			ctx = identity.WithRequester(ctx, &identity.StaticRequester{
				OrgID: 1,
				Permissions: map[int64]map[string][]string{
					1: tc.perms,
				},
			})
			attrs := buildVariableAttributesForOp(tc.op, newVariable, oldVariable)

			err := builder.Validate(ctx, attrs, nil)
			if tc.expected {
				require.NoError(t, err)
				return
			}

			require.Error(t, err)
			require.True(t, apierrors.IsNotFound(err) || apierrors.IsForbidden(err))
		})
	}
}

func TestVariableMutationPermissionsFolderLookupError(t *testing.T) {
	folderUID := "folder-a"
	oldVariable := newCustomVariable("region", "region--folder-a")
	oldVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	newVariable := newCustomVariable("region", "region--folder-a")
	newVariable.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})

	lookupErr := errors.New("folder lookup timed out")
	builder := &DashboardsAPIBuilder{
		accessControl: acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		folderClientProvider: &staticHandlerProvider{
			handler: &variableFolderAccessHandler{getError: lookupErr},
		},
	}

	ctx := k8srequest.WithNamespace(context.Background(), "stacks-1")
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{
		OrgID: 1,
		// No folder-scoped grant so Evaluate fails and allowMissingFolder path runs.
		Permissions: map[int64]map[string][]string{
			1: {ActionVariablesWrite: {folder.ScopeFoldersProvider.GetResourceScopeUID("other-folder")}},
		},
	})

	err := builder.Validate(ctx, buildVariableAttributesForOp(admission.Update, newVariable, oldVariable), nil)
	require.ErrorIs(t, err, lookupErr)
	require.False(t, apierrors.IsForbidden(err))
}

func newCustomVariable(variableName, metadataName string) *dashv2beta1.Variable {
	customVariable := dashv2beta1.NewDashboardCustomVariableKind()
	customVariable.Spec.Name = variableName

	spec := dashv2beta1.NewVariableSpec()
	spec.CustomVariableKind = customVariable

	return &dashv2beta1.Variable{
		ObjectMeta: metav1.ObjectMeta{
			Name: metadataName,
		},
		Spec: *spec,
	}
}

func TestDeriveVariableMetadataName(t *testing.T) {
	t.Run("global scope uses spec name", func(t *testing.T) {
		require.Equal(t, "status", deriveVariableMetadataName("status", ""))
	})
	t.Run("folder scope appends folder uid with delimiter", func(t *testing.T) {
		require.Equal(t, "status--folder-a", deriveVariableMetadataName("status", "folder-a"))
	})
}

func TestValidateVariableMetadataName(t *testing.T) {
	t.Run("empty metadata name is allowed and will be derived by mutation", func(t *testing.T) {
		require.NoError(t, validateVariableMetadataName("", "status", "folder-a"))
	})
	t.Run("matching folder scoped metadata name is accepted", func(t *testing.T) {
		require.NoError(t, validateVariableMetadataName("status--folder-a", "status", "folder-a"))
	})
	t.Run("matching global metadata name is accepted", func(t *testing.T) {
		require.NoError(t, validateVariableMetadataName("status", "status", ""))
	})
	t.Run("mismatch returns actionable folder-scoped error", func(t *testing.T) {
		err := validateVariableMetadataName("status5", "status", "abcdef")
		require.Error(t, err)
		require.Contains(t, err.Error(), `expected "status--abcdef"`)
		require.Contains(t, err.Error(), "omit metadata.name")
	})
	t.Run("mismatch returns actionable global error", func(t *testing.T) {
		err := validateVariableMetadataName("status--abcdef", "status", "")
		require.Error(t, err)
		require.Contains(t, err.Error(), `expected "status"`)
	})
	t.Run("derived name longer than max length is rejected", func(t *testing.T) {
		tooLong := strings.Repeat("x", variableMetadataNameMaxLength)
		err := validateVariableMetadataName("", "status", tooLong)
		require.ErrorContains(t, err, "derived metadata.name exceeds maximum length")
	})
}

func buildVariableAttributesForOp(op admission.Operation, newVariable, oldVariable *dashv2beta1.Variable) admission.Attributes {
	switch op {
	case admission.Create:
		return admission.NewAttributesRecord(
			newVariable,
			nil,
			dashv2beta1.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			newVariable.GetName(),
			dashv2beta1.VariableResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
	case admission.Update:
		return admission.NewAttributesRecord(
			newVariable,
			oldVariable,
			dashv2beta1.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			newVariable.GetName(),
			dashv2beta1.VariableResourceInfo.GroupVersionResource(),
			"",
			admission.Update,
			&metav1.UpdateOptions{},
			false,
			nil,
		)
	default:
		return admission.NewAttributesRecord(
			nil,
			oldVariable,
			dashv2beta1.VariableResourceInfo.GroupVersionKind(),
			"stacks-1",
			oldVariable.GetName(),
			dashv2beta1.VariableResourceInfo.GroupVersionResource(),
			"",
			admission.Delete,
			&metav1.DeleteOptions{},
			false,
			nil,
		)
	}
}

type staticHandlerProvider struct {
	handler client.K8sHandler
}

func (p *staticHandlerProvider) GetOrCreateHandler(namespace string) client.K8sHandler {
	return p.handler
}

type variableFolderAccessHandler struct {
	accessSubresourceChecked   bool
	forbiddenAccessSubresource bool
	notFoundAccessSubresource  bool
	getError                   error
}

func (h *variableFolderAccessHandler) Get(_ context.Context, name string, _ int64, _ metav1.GetOptions, subresource ...string) (*unstructured.Unstructured, error) {
	if len(subresource) > 0 && subresource[0] == "access" {
		h.accessSubresourceChecked = true
		if h.notFoundAccessSubresource {
			return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
		}
		if h.forbiddenAccessSubresource {
			return nil, apierrors.NewForbidden(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name, nil)
		}

		return &unstructured.Unstructured{
			Object: map[string]any{
				"canEdit": true,
			},
		}, nil
	}

	if h.getError != nil {
		return nil, h.getError
	}

	if h.notFoundAccessSubresource {
		return nil, apierrors.NewNotFound(schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}, name)
	}

	return &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"name": name,
			},
		},
	}, nil
}

func (h *variableFolderAccessHandler) GetNamespace(_ int64) string { return "stacks-1" }
func (h *variableFolderAccessHandler) Create(_ context.Context, _ *unstructured.Unstructured, _ int64, _ metav1.CreateOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) Update(_ context.Context, _ *unstructured.Unstructured, _ int64, _ metav1.UpdateOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (m *variableFolderAccessHandler) Patch(_ context.Context, _ string, _ types.PatchType, _ []byte, _ int64, _ metav1.PatchOptions) (*unstructured.Unstructured, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) Delete(_ context.Context, _ string, _ int64, _ metav1.DeleteOptions) error {
	return nil
}
func (h *variableFolderAccessHandler) DeleteCollection(_ context.Context, _ int64, _ metav1.ListOptions) error {
	return nil
}
func (h *variableFolderAccessHandler) List(_ context.Context, _ int64, _ metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) Search(_ context.Context, _ int64, _ *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) GetStats(_ context.Context, _ int64) (*resourcepb.ResourceStatsResponse, error) {
	return nil, nil
}
func (h *variableFolderAccessHandler) GetUsersFromMeta(_ context.Context, _ []string) (map[string]*user.User, error) {
	return nil, nil
}
