package manager

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/teamguardian/database"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestUpdateTeam(t *testing.T) {
	store := new(database.TeamGuardianStoreMock)
	teamGuardianService := ProvideService(store)

	t.Run("Updating a team", func(t *testing.T) {
		admin := user.SignedInUser{
			UserID:  1,
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		}
		editor := user.SignedInUser{
			UserID:  2,
			OrgID:   1,
			OrgRole: org.RoleEditor,
		}
		testTeam := team.Team{
			ID:    1,
			OrgID: 1,
		}

		t.Run("Given an editor and a team he isn't a member of", func(t *testing.T) {
			t.Run("Should not be able to update the team", func(t *testing.T) {
				ctx := context.Background()
				store.On("GetTeamMembers", ctx, mock.Anything).Return([]*team.TeamMemberDTO{}, nil).Once()
				err := teamGuardianService.CanAdmin(ctx, testTeam.OrgID, testTeam.ID, &editor)
				require.Equal(t, team.ErrNotAllowedToUpdateTeam, err)
			})
		})

		t.Run("Given an editor and a team he is an admin in", func(t *testing.T) {
			t.Run("Should be able to update the team", func(t *testing.T) {
				ctx := context.Background()

				result := []*team.TeamMemberDTO{{
					OrgID:      testTeam.OrgID,
					TeamID:     testTeam.ID,
					UserID:     editor.UserID,
					Permission: dashboards.PERMISSION_ADMIN,
				}}

				store.On("GetTeamMembers", ctx, mock.Anything).Return(result, nil).Once()
				err := teamGuardianService.CanAdmin(ctx, testTeam.OrgID, testTeam.ID, &editor)
				require.NoError(t, err)
			})
		})

		t.Run("Given an editor and a team in another org", func(t *testing.T) {
			ctx := context.Background()

			testTeamOtherOrg := team.Team{
				ID:    1,
				OrgID: 2,
			}

			t.Run("Shouldn't be able to update the team", func(t *testing.T) {
				result := []*team.TeamMemberDTO{{
					OrgID:      testTeamOtherOrg.OrgID,
					TeamID:     testTeamOtherOrg.ID,
					UserID:     editor.UserID,
					Permission: dashboards.PERMISSION_ADMIN,
				}}

				store.On("GetTeamMembers", ctx, mock.Anything).Return(result, nil).Once()
				err := teamGuardianService.CanAdmin(ctx, testTeamOtherOrg.OrgID, testTeamOtherOrg.ID, &editor)
				require.Equal(t, team.ErrNotAllowedToUpdateTeamInDifferentOrg, err)
			})
		})

		t.Run("Given an org admin and a team", func(t *testing.T) {
			t.Run("Should be able to update the team", func(t *testing.T) {
				err := teamGuardianService.CanAdmin(context.Background(), testTeam.OrgID, testTeam.ID, &admin)
				require.NoError(t, err)
			})
		})
	})
}
