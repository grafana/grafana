package teamguardian

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

func TestUpdateTeam(t *testing.T) {
	t.Run("Updating a team", func(t *testing.T) {
		bus.ClearBusHandlers()

		admin := models.SignedInUser{
			UserId:  1,
			OrgId:   1,
			OrgRole: models.ROLE_ADMIN,
		}
		editor := models.SignedInUser{
			UserId:  2,
			OrgId:   1,
			OrgRole: models.ROLE_EDITOR,
		}
		testTeam := models.Team{
			Id:    1,
			OrgId: 1,
		}

		t.Run("Given an editor and a team he isn't a member of", func(t *testing.T) {
			t.Run("Should not be able to update the team", func(t *testing.T) {
				bus.AddHandler("test", func(cmd *models.GetTeamMembersQuery) error {
					cmd.Result = []*models.TeamMemberDTO{}
					return nil
				})

				err := CanAdmin(bus.GetBus(), testTeam.OrgId, testTeam.Id, &editor)
				require.Equal(t, models.ErrNotAllowedToUpdateTeam, err)
			})
		})

		t.Run("Given an editor and a team he is an admin in", func(t *testing.T) {
			t.Run("Should be able to update the team", func(t *testing.T) {
				bus.AddHandler("test", func(cmd *models.GetTeamMembersQuery) error {
					cmd.Result = []*models.TeamMemberDTO{{
						OrgId:      testTeam.OrgId,
						TeamId:     testTeam.Id,
						UserId:     editor.UserId,
						Permission: models.PERMISSION_ADMIN,
					}}
					return nil
				})

				err := CanAdmin(bus.GetBus(), testTeam.OrgId, testTeam.Id, &editor)
				require.NoError(t, err)
			})
		})

		t.Run("Given an editor and a team in another org", func(t *testing.T) {
			testTeamOtherOrg := models.Team{
				Id:    1,
				OrgId: 2,
			}

			t.Run("Shouldn't be able to update the team", func(t *testing.T) {
				bus.AddHandler("test", func(cmd *models.GetTeamMembersQuery) error {
					cmd.Result = []*models.TeamMemberDTO{{
						OrgId:      testTeamOtherOrg.OrgId,
						TeamId:     testTeamOtherOrg.Id,
						UserId:     editor.UserId,
						Permission: models.PERMISSION_ADMIN,
					}}
					return nil
				})

				err := CanAdmin(bus.GetBus(), testTeamOtherOrg.OrgId, testTeamOtherOrg.Id, &editor)
				require.Equal(t, models.ErrNotAllowedToUpdateTeamInDifferentOrg, err)
			})
		})

		t.Run("Given an org admin and a team", func(t *testing.T) {
			t.Run("Should be able to update the team", func(t *testing.T) {
				err := CanAdmin(bus.GetBus(), testTeam.OrgId, testTeam.Id, &admin)
				require.NoError(t, err)
			})
		})
	})
}
