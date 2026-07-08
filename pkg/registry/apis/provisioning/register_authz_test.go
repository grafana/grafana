package provisioning

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
