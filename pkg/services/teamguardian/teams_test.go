package teamguardian

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestUpdateTeam(t *testing.T) {
	Convey("Updating a team", t, func() {
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

		Convey("Given an editor and a team he isn't a member of", func() {
			Convey("Should not be able to update the team", func() {
				bus.AddHandler("test", func(cmd *models.GetTeamMembersQuery) error {
					cmd.Result = []*models.TeamMemberDTO{}
					return nil
				})

				err := CanAdmin(bus.GetBus(), testTeam.OrgId, testTeam.Id, &editor)
				So(err, ShouldEqual, models.ErrNotAllowedToUpdateTeam)
			})
		})

		Convey("Given an editor and a team he is an admin in", func() {
			Convey("Should be able to update the team", func() {
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
				So(err, ShouldBeNil)
			})
		})

		Convey("Given an editor and a team in another org", func() {
			testTeamOtherOrg := models.Team{
				Id:    1,
				OrgId: 2,
			}

			Convey("Shouldn't be able to update the team", func() {
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
				So(err, ShouldEqual, models.ErrNotAllowedToUpdateTeamInDifferentOrg)
			})
		})

		Convey("Given an org admin and a team", func() {
			Convey("Should be able to update the team", func() {
				err := CanAdmin(bus.GetBus(), testTeam.OrgId, testTeam.Id, &admin)
				So(err, ShouldBeNil)
			})
		})
	})
}
