package teamguardian

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
	"testing"
)

func TestUpdateTeam(t *testing.T) {
	Convey("Updating a team", t, func() {
		bus.ClearBusHandlers()

		admin := m.SignedInUser{
			UserId:  1,
			OrgId:   1,
			OrgRole: m.ROLE_ADMIN,
		}
		editor := m.SignedInUser{
			UserId:  2,
			OrgId:   1,
			OrgRole: m.ROLE_EDITOR,
		}
		testTeam := m.Team{
			Id:    1,
			OrgId: 1,
		}

		Convey("Given an editor and a team he isn't a member of", func() {
			Convey("Should not be able to update the team", func() {
				bus.AddHandler("test", func(cmd *m.GetTeamMembersQuery) error {
					cmd.Result = []*m.TeamMemberDTO{}
					return nil
				})

				err := CanAdmin(bus.GetBus(), testTeam.OrgId, testTeam.Id, &editor)
				So(err, ShouldEqual, m.ErrNotAllowedToUpdateTeam)
			})
		})

		Convey("Given an editor and a team he is an admin in", func() {
			Convey("Should be able to update the team", func() {
				bus.AddHandler("test", func(cmd *m.GetTeamMembersQuery) error {
					cmd.Result = []*m.TeamMemberDTO{{
						OrgId:      testTeam.OrgId,
						TeamId:     testTeam.Id,
						UserId:     editor.UserId,
						Permission: m.PERMISSION_ADMIN,
					}}
					return nil
				})

				err := CanAdmin(bus.GetBus(), testTeam.OrgId, testTeam.Id, &editor)
				So(err, ShouldBeNil)
			})
		})

		Convey("Given an editor and a team in another org", func() {
			testTeamOtherOrg := m.Team{
				Id:    1,
				OrgId: 2,
			}

			Convey("Shouldn't be able to update the team", func() {
				bus.AddHandler("test", func(cmd *m.GetTeamMembersQuery) error {
					cmd.Result = []*m.TeamMemberDTO{{
						OrgId:      testTeamOtherOrg.OrgId,
						TeamId:     testTeamOtherOrg.Id,
						UserId:     editor.UserId,
						Permission: m.PERMISSION_ADMIN,
					}}
					return nil
				})

				err := CanAdmin(bus.GetBus(), testTeamOtherOrg.OrgId, testTeamOtherOrg.Id, &editor)
				So(err, ShouldEqual, m.ErrNotAllowedToUpdateTeamInDifferentOrg)
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
