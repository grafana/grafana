package api

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestGetUserTeamsAuthorization(t *testing.T) {
	for _, tc := range []struct {
		name        string
		permissions map[int64]map[string][]string
		status      int
	}{
		{
			name:        "organization reader",
			permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {}}},
			status:      http.StatusOK,
		},
		{
			name:        "global reader",
			permissions: map[int64]map[string][]string{1: {ac.ActionUsersRead: {ac.ScopeGlobalUsersAll}}},
			status:      http.StatusOK,
		},
		{
			name:        "reader scoped to target user",
			permissions: map[int64]map[string][]string{1: {ac.ActionUsersRead: {"global.users:id:42"}}},
			status:      http.StatusOK,
		},
		{
			name:        "reader scoped to another user",
			permissions: map[int64]map[string][]string{1: {ac.ActionUsersRead: {"global.users:id:43"}}},
			status:      http.StatusForbidden,
		},
		{
			name:        "reader in another organization",
			permissions: map[int64]map[string][]string{2: {ac.ActionOrgUsersRead: {}}},
			status:      http.StatusForbidden,
		},
		{
			name:        "team reader without user read permission",
			permissions: map[int64]map[string][]string{1: {ac.ActionTeamsRead: {ac.ScopeTeamsAll}}},
			status:      http.StatusForbidden,
		},
		{name: "no permissions", status: http.StatusForbidden},
	} {
		for _, id := range []string{"42", "alice"} {
			t.Run(tc.name+"/"+id, func(t *testing.T) {
				teams := &userTeamsQueryRecorder{}
				server := SetupAPITestServer(t, func(hs *HTTPServer) {
					hs.TeamService = teams
					hs.userService = &usertest.FakeUserService{ExpectedUser: &user.User{ID: 42, UID: "alice"}}
				})
				caller := &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: tc.permissions}
				res, err := server.Send(webtest.RequestWithSignedInUser(server.NewRequest(http.MethodGet, "/api/users/"+id+"/teams?orgId=2", nil), caller))
				require.NoError(t, err)
				t.Cleanup(func() { require.NoError(t, res.Body.Close()) })
				require.Equal(t, tc.status, res.StatusCode)
				if tc.status != http.StatusOK {
					require.Nil(t, teams.query)
					return
				}
				require.NotNil(t, teams.query)
				require.Equal(t, int64(1), teams.query.OrgID)
				require.Equal(t, int64(42), teams.query.UserID)
				require.Same(t, caller, teams.query.SignedInUser)
				var result []*team.TeamDTO
				require.NoError(t, json.NewDecoder(res.Body).Decode(&result))
				require.Len(t, result, 1)
				require.Equal(t, "platform", result[0].UID)
			})
		}
	}
}

func TestOrganizationReaderCannotReadGlobalUserDetails(t *testing.T) {
	server := SetupAPITestServer(t)
	caller := &user.SignedInUser{
		UserID:      1,
		OrgID:       1,
		Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {}}},
	}
	for _, path := range []string{"/api/users/42", "/api/users/42/orgs"} {
		t.Run(path, func(t *testing.T) {
			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewRequest(http.MethodGet, path, nil), caller))
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, res.Body.Close()) })
			require.Equal(t, http.StatusForbidden, res.StatusCode)
		})
	}
}

type userTeamsQueryRecorder struct {
	teamtest.FakeService
	query *team.GetTeamsByUserQuery
}

func (s *userTeamsQueryRecorder) GetTeamsByUser(_ context.Context, query *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	s.query = query
	return []*team.TeamDTO{{UID: "platform", OrgID: 1, Name: "Platform"}}, nil
}
