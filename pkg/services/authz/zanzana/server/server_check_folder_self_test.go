package server

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationServerCheck_FolderSelfRead is a spike test for the folders.self:read / get_self
// design (identity-access-team#2285, Phase 1). It empirically verifies the two safety properties
// the design relies on, rather than trusting the schema reasoning by inspection:
//
//  1. get_self does NOT recurse to child folders (unlike every other assignable folder relation,
//     which all include "or <relation> from parent").
//  2. get_self does NOT leak read on subresources (dashboards) placed directly in the folder.
//     This resolves open question #2 in the epic as option (a): self-read is pure navigation,
//     the folder's direct contents are not included.
func TestIntegrationServerCheck_FolderSelfRead(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	srv := setupOpenFGAServer(t)

	const (
		parentFolder = "self-parent"
		childFolder  = "self-child"
		viewFolder   = "view-parent"
	)

	tuples := []*openfgav1.TupleKey{
		// The grant under test: get_self directly on the parent folder only.
		common.NewFolderTuple("user:self-only", common.RelationGetSelf, parentFolder),
		// Parent/child relationship so recursion (or lack of it) can be observed.
		common.NewFolderParentTuple(childFolder, parentFolder),
		// Control: a real Viewer-tier grant on a separate folder, to contrast against get_self
		// in the "sanity" case below.
		common.NewFolderTuple("user:full-view", common.RelationSetView, viewFolder),
	}
	setupOpenFGADatabase(t, srv, tuples)

	newReq := func(subject, verb, group, resource, subresource, folder, name string) *authzv1.CheckRequest {
		return &authzv1.CheckRequest{
			Namespace:   namespace,
			Subject:     subject,
			Verb:        verb,
			Group:       group,
			Resource:    resource,
			Subresource: subresource,
			Name:        name,
			Folder:      folder,
		}
	}

	t.Run("get_self grants get on the folder itself", func(t *testing.T) {
		res, err := srv.Check(newContextWithNamespace(), newReq("user:self-only", utils.VerbGet, folderGroup, folderResource, "", "", parentFolder))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed(), "get_self on X should satisfy a get check on X")
	})

	t.Run("get_self does NOT recurse to a child folder", func(t *testing.T) {
		res, err := srv.Check(newContextWithNamespace(), newReq("user:self-only", utils.VerbGet, folderGroup, folderResource, "", "", childFolder))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed(), "get_self on X must not grant get on X's children")
	})

	t.Run("get_self does NOT leak read on a dashboard directly inside the folder", func(t *testing.T) {
		res, err := srv.Check(newContextWithNamespace(), newReq("user:self-only", utils.VerbGet, dashboardGroup, dashboardResource, "", parentFolder, "dash-in-self-only-folder"))
		require.NoError(t, err)
		assert.False(t, res.GetAllowed(), "get_self must not expose the folder's direct contents (resolves open question #2 as option (a))")
	})

	t.Run("sanity: a real Viewer-tier grant (view relation) on a folder DOES expose direct content", func(t *testing.T) {
		// Control case, using a separate folder so it doesn't interfere with the self-only assertions
		// above: confirms the *contrast* with get_self is real, not an artifact of the test setup.
		res, err := srv.Check(newContextWithNamespace(), newReq("user:full-view", utils.VerbGet, dashboardGroup, dashboardResource, "", viewFolder, "dash-in-view-folder"))
		require.NoError(t, err)
		assert.True(t, res.GetAllowed(), "a real view-tier grant should expose direct content, unlike get_self")
	})
}
