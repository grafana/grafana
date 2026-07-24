package provisioning

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func mockForbidden() error {
	return apierrors.NewForbidden(schema.GroupResource{}, "", fmt.Errorf("forbidden"))
}

func subresourceAttrs(sub, name, ns string) authorizer.Attributes {
	return authorizer.AttributesRecord{
		Subresource: sub,
		Name:        name,
		Namespace:   ns,
		Verb:        "get",
	}
}

// TestAuthorizeRepositorySubresource verifies the refs and admin-view subresource gates.
//
// refs must be available to editors (push/PR flow) and to repository managers/admins
// (repo setup), but NOT to viewers. Since the repositories resource has no Editor tier,
// it is authorized as repositories:write (admin) OR jobs:create (editor).
//
// resources/history/status are admin-only and gated on repositories:write so that the
// repository-scoped Name is preserved (rather than proxying through an unrelated resource).
func TestAuthorizeRepositorySubresource(t *testing.T) {
	ctx := context.Background()
	const ns, name = "default", "my-repo"

	repoWriteReq := func(req authlib.CheckRequest) bool {
		return req.Verb == utils.VerbUpdate &&
			req.Group == provisioning.GROUP &&
			req.Resource == provisioning.RepositoryResourceInfo.GetName() &&
			req.Name == name &&
			req.Namespace == ns
	}
	jobsCreateReq := func(req authlib.CheckRequest) bool {
		return req.Verb == utils.VerbCreate &&
			req.Group == provisioning.GROUP &&
			req.Resource == provisioning.JobResourceInfo.GetName() &&
			req.Namespace == ns
	}

	t.Run("refs: repository writer (admin) is allowed without consulting jobs", func(t *testing.T) {
		adminChecker := auth.NewMockAccessChecker(t)
		adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(repoWriteReq), "").Return(nil)

		b := &APIBuilder{accessWithAdmin: adminChecker, accessWithEditor: auth.NewMockAccessChecker(t)}
		decision, _, err := b.authorizeRepositorySubresource(ctx, subresourceAttrs("refs", name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("refs: editor who can create jobs is allowed", func(t *testing.T) {
		adminChecker := auth.NewMockAccessChecker(t)
		adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(repoWriteReq), "").Return(mockForbidden())
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(jobsCreateReq), "").Return(nil)

		b := &APIBuilder{accessWithAdmin: adminChecker, accessWithEditor: editorChecker}
		decision, _, err := b.authorizeRepositorySubresource(ctx, subresourceAttrs("refs", name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("refs: viewer (neither repo write nor jobs create) is denied", func(t *testing.T) {
		adminChecker := auth.NewMockAccessChecker(t)
		adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(repoWriteReq), "").Return(mockForbidden())
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(jobsCreateReq), "").Return(mockForbidden())

		b := &APIBuilder{accessWithAdmin: adminChecker, accessWithEditor: editorChecker}
		decision, _, err := b.authorizeRepositorySubresource(ctx, subresourceAttrs("refs", name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	for _, sub := range []string{"resources", "history", "status"} {
		t.Run(sub+": admin (repositories:write) is allowed", func(t *testing.T) {
			adminChecker := auth.NewMockAccessChecker(t)
			adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(repoWriteReq), "").Return(nil)

			b := &APIBuilder{accessWithAdmin: adminChecker}
			decision, _, err := b.authorizeRepositorySubresource(ctx, subresourceAttrs(sub, name, ns))
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionAllow, decision)
		})

		t.Run(sub+": non-admin is denied", func(t *testing.T) {
			adminChecker := auth.NewMockAccessChecker(t)
			adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(repoWriteReq), "").Return(mockForbidden())

			b := &APIBuilder{accessWithAdmin: adminChecker}
			decision, _, err := b.authorizeRepositorySubresource(ctx, subresourceAttrs(sub, name, ns))
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionDeny, decision)
		})
	}
}

func jobsSubresourceAttrs(verb, name, ns string) authorizer.Attributes {
	return authorizer.AttributesRecord{
		Verb:        verb,
		Subresource: "jobs",
		Name:        name,
		Namespace:   ns,
	}
}

// TestAuthorizeJobsSubresource verifies the jobs subresource authorization,
// including the folder-level fallback for Git Sync (issue #127254).
//
// When a user moves or deletes a dashboard in a Git Sync folder, a sync job is
// triggered via the repositories/{name}/jobs subresource. The primary check
// requires the global provisioning.jobs:create permission (Editor role). The
// fallback allows users who lack this global permission but have dashboards:write
// on the repository's root folder (Folder Admins) to manage sync jobs.
func TestAuthorizeJobsSubresource(t *testing.T) {
	ctx := context.Background()
	const ns, name = "default", "my-repo"

	dashboardWriteOnFolder := func(req authlib.CheckRequest) bool {
		return req.Verb == utils.VerbUpdate &&
			req.Group == resources.DashboardResource.Group &&
			req.Resource == resources.DashboardResource.Resource &&
			req.Namespace == ns
	}

	newFolderRepo := func(name string) *provisioning.Repository {
		return &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{
					Target: provisioning.SyncTargetTypeFolder,
				},
			},
		}
	}

	newInstanceRepo := func(name string) *provisioning.Repository {
		return &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{
					Target: provisioning.SyncTargetTypeInstance,
				},
			},
		}
	}

	t.Run("editor with global jobs permission is allowed without fallback", func(t *testing.T) {
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(func(req authlib.CheckRequest) bool {
			return req.Verb == utils.VerbCreate &&
				req.Group == provisioning.GROUP &&
				req.Resource == provisioning.JobResourceInfo.GetName() &&
				req.Namespace == ns
		}), "").Return(nil)

		b := &APIBuilder{accessWithEditor: editorChecker}
		decision, _, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(utils.VerbCreate, name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("folder admin with dashboards:write on folder-targeted repo is allowed via fallback", func(t *testing.T) {
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(mockForbidden())

		accessChecker := auth.NewMockAccessChecker(t)
		accessChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(dashboardWriteOnFolder), name).Return(nil)

		repoStore := grafanarest.NewMockStorage(t)
		repoStore.EXPECT().Get(mock.Anything, name, mock.Anything).Return(newFolderRepo(name), nil)

		b := &APIBuilder{accessWithEditor: editorChecker, access: accessChecker, repoStore: repoStore}
		decision, _, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(utils.VerbCreate, name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("viewer without any permission is denied", func(t *testing.T) {
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(mockForbidden())

		accessChecker := auth.NewMockAccessChecker(t)
		accessChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(dashboardWriteOnFolder), name).Return(mockForbidden())

		repoStore := grafanarest.NewMockStorage(t)
		repoStore.EXPECT().Get(mock.Anything, name, mock.Anything).Return(newFolderRepo(name), nil)

		b := &APIBuilder{accessWithEditor: editorChecker, access: accessChecker, repoStore: repoStore}
		decision, _, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(utils.VerbCreate, name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("instance-targeted repo skips folder fallback and is denied", func(t *testing.T) {
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(mockForbidden())

		repoStore := grafanarest.NewMockStorage(t)
		repoStore.EXPECT().Get(mock.Anything, name, mock.Anything).Return(newInstanceRepo(name), nil)

		b := &APIBuilder{accessWithEditor: editorChecker, repoStore: repoStore}
		decision, _, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(utils.VerbCreate, name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("empty name skips fallback and is denied", func(t *testing.T) {
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(mockForbidden())

		b := &APIBuilder{accessWithEditor: editorChecker}
		decision, _, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(utils.VerbCreate, "", ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("repo store error skips fallback and is denied", func(t *testing.T) {
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(mockForbidden())

		repoStore := grafanarest.NewMockStorage(t)
		repoStore.EXPECT().Get(mock.Anything, name, mock.Anything).Return(nil, fmt.Errorf("not found"))

		b := &APIBuilder{accessWithEditor: editorChecker, repoStore: repoStore}
		decision, _, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(utils.VerbCreate, name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("unauthorized skips folder fallback", func(t *testing.T) {
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(
			apierrors.NewUnauthorized("no auth info in context"),
		)

		// repoStore/access deliberately unset: fallback must not run on Unauthorized.
		b := &APIBuilder{accessWithEditor: editorChecker}
		decision, reason, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(utils.VerbCreate, name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
		assert.Contains(t, reason, "no auth info in context")
	})

	t.Run("list/get/watch fallback requires dashboards:write not read", func(t *testing.T) {
		for _, verb := range []string{utils.VerbList, utils.VerbGet, utils.VerbWatch} {
			t.Run(verb, func(t *testing.T) {
				editorChecker := auth.NewMockAccessChecker(t)
				editorChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(mockForbidden())

				accessChecker := auth.NewMockAccessChecker(t)
				accessChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(dashboardWriteOnFolder), name).Return(nil)

				repoStore := grafanarest.NewMockStorage(t)
				repoStore.EXPECT().Get(mock.Anything, name, mock.Anything).Return(newFolderRepo(name), nil)

				b := &APIBuilder{accessWithEditor: editorChecker, access: accessChecker, repoStore: repoStore}
				decision, _, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(verb, name, ns))
				require.NoError(t, err)
				assert.Equal(t, authorizer.DecisionAllow, decision)
			})
		}
	})

	t.Run("viewer with only dashboards:read is denied via fallback", func(t *testing.T) {
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(mockForbidden())

		accessChecker := auth.NewMockAccessChecker(t)
		accessChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(dashboardWriteOnFolder), name).Return(mockForbidden())

		repoStore := grafanarest.NewMockStorage(t)
		repoStore.EXPECT().Get(mock.Anything, name, mock.Anything).Return(newFolderRepo(name), nil)

		b := &APIBuilder{accessWithEditor: editorChecker, access: accessChecker, repoStore: repoStore}
		decision, _, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(utils.VerbList, name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("folderless repo skips folder fallback and is denied", func(t *testing.T) {
		editorChecker := auth.NewMockAccessChecker(t)
		editorChecker.EXPECT().Check(mock.Anything, mock.Anything, "").Return(mockForbidden())

		folderlessRepo := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
			Spec: provisioning.RepositorySpec{
				Sync: provisioning.SyncOptions{
					Target: provisioning.SyncTargetTypeFolderless,
				},
			},
		}
		repoStore := grafanarest.NewMockStorage(t)
		repoStore.EXPECT().Get(mock.Anything, name, mock.Anything).Return(folderlessRepo, nil)

		b := &APIBuilder{accessWithEditor: editorChecker, repoStore: repoStore}
		decision, _, err := b.authorizeRepositorySubresource(ctx, jobsSubresourceAttrs(utils.VerbCreate, name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})
}
