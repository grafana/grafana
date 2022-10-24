package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/teamguardian/database"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
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
		testTeam := models.Team{
			Id:    1,
			OrgId: 1,
		}

		t.Run("Given an editor and a team he isn't a member of", func(t *testing.T) {
			t.Run("Should not be able to update the team", func(t *testing.T) {
				ctx := context.Background()
				store.On("GetTeamMembers", ctx, mock.Anything).Return([]*models.TeamMemberDTO{}, nil).Once()
				err := teamGuardianService.CanAdmin(ctx, testTeam.OrgId, testTeam.Id, &editor)
				require.Equal(t, models.ErrNotAllowedToUpdateTeam, err)
			})
		})

		t.Run("Given an editor and a team he is an admin in", func(t *testing.T) {
			t.Run("Should be able to update the team", func(t *testing.T) {
				ctx := context.Background()

				result := []*models.TeamMemberDTO{{
					OrgId:      testTeam.OrgId,
					TeamId:     testTeam.Id,
					UserId:     editor.UserID,
					Permission: models.PERMISSION_ADMIN,
				}}

				store.On("GetTeamMembers", ctx, mock.Anything).Return(result, nil).Once()
				err := teamGuardianService.CanAdmin(ctx, testTeam.OrgId, testTeam.Id, &editor)
				require.NoError(t, err)
			})
		})

		t.Run("Given an editor and a team in another org", func(t *testing.T) {
			ctx := context.Background()

			testTeamOtherOrg := models.Team{
				Id:    1,
				OrgId: 2,
			}

			t.Run("Shouldn't be able to update the team", func(t *testing.T) {
				result := []*models.TeamMemberDTO{{
					OrgId:      testTeamOtherOrg.OrgId,
					TeamId:     testTeamOtherOrg.Id,
					UserId:     editor.UserID,
					Permission: models.PERMISSION_ADMIN,
				}}

				store.On("GetTeamMembers", ctx, mock.Anything).Return(result, nil).Once()
				err := teamGuardianService.CanAdmin(ctx, testTeamOtherOrg.OrgId, testTeamOtherOrg.Id, &editor)
				require.Equal(t, models.ErrNotAllowedToUpdateTeamInDifferentOrg, err)
			})
		})

		t.Run("Given an org admin and a team", func(t *testing.T) {
			t.Run("Should be able to update the team", func(t *testing.T) {
				err := teamGuardianService.CanAdmin(context.Background(), testTeam.OrgId, testTeam.Id, &admin)
				require.NoError(t, err)
			})
		})
	})
}
