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

// TestIntegrationServerCheck_TeamFolderEditGrantsDashboardCreate isolates the question that
// the live multi-instance env could not answer cleanly (reconciler pruning, two stores,
// per-instance caches): does a folder-level "edit" grant to a team, plus the team supplied
// as a per-request contextual membership, allow creating a dashboard in that folder?
//
// The seeded tuple is EXACTLY what a resourcepermission "Editor" grant to a team on a folder
// produces today: a single folder#edit tuple for team#member, with no dashboard subresource tuple.
func TestIntegrationServerCheck_TeamFolderEditGrantsDashboardCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	srv := setupOpenFGAServer(t)

	const (
		folderUID = "team-folder"
		teamName  = "editors-viewers"
	)

	tuples := []*openfgav1.TupleKey{
		// What the grant writes: folder-level edit for the team. Nothing else.
		common.NewFolderTuple("team:"+teamName+"#member", common.RelationSetEdit, folderUID),
		// Control: a direct user edit grant on a separate folder (no team involved).
		common.NewFolderTuple("user:direct", common.RelationSetEdit, "direct-folder"),
	}
	setupOpenFGADatabase(t, srv, tuples)

	newCreateReq := func(subject, folder string, teams []string) *authzv1.CheckRequest {
		return &authzv1.CheckRequest{
			Namespace: namespace,
			Subject:   subject,
			Verb:      utils.VerbCreate,
			Group:     dashboardGroup,
			Resource:  dashboardResource,
			Folder:    folder,
			Name:      "", // create uses generateName -> empty name
			Teams:     teams,
		}
	}

	t.Run("team member CAN create a dashboard via contextual team membership + folder edit", func(t *testing.T) {
		req := newCreateReq("user:editor", folderUID, []string{teamName})
		res, err := srv.Check(newContextWithNamespace(), req)
		require.NoError(t, err)
		assert.True(t, res.GetAllowed(), "folder#edit @ team#member + contextual membership should grant dashboard create")
	})

	t.Run("same user is DENIED when the team membership is not supplied as a contextual", func(t *testing.T) {
		req := newCreateReq("user:editor", folderUID, nil)
		res, err := srv.Check(newContextWithNamespace(), req)
		require.NoError(t, err)
		assert.False(t, res.GetAllowed())
	})

	t.Run("direct folder edit grant also allows dashboard create (no team, no subresource tuple)", func(t *testing.T) {
		req := newCreateReq("user:direct", "direct-folder", nil)
		res, err := srv.Check(newContextWithNamespace(), req)
		require.NoError(t, err)
		assert.True(t, res.GetAllowed())
	})
}
