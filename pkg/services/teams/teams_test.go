package teams

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/pkg/errors"
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

		updateTeamCmd := m.UpdateTeamCommand{
			Id:    testTeam.Id,
			OrgId: testTeam.OrgId,
		}

		Convey("Given an editor and a team he isn't a member of", func() {
			Convey("Should not be able to update the team", func() {
				shouldNotUpdateTeam()
				bus.AddHandler("test", func(cmd *m.GetTeamMembersQuery) error {
					cmd.Result = []*m.TeamMemberDTO{}
					return nil
				})

				err := UpdateTeam(&editor, &updateTeamCmd)
				So(err, ShouldEqual, m.ErrNotAllowedToUpdateTeam)
			})
		})

		Convey("Given an editor and a team he is a member of", func() {
			Convey("Should be able to update the team", func() {
				teamUpdatedCallback := updateTeamCalled()

				bus.AddHandler("test", func(cmd *m.GetTeamMembersQuery) error {
					cmd.Result = []*m.TeamMemberDTO{{
						OrgId:      testTeam.OrgId,
						TeamId:     testTeam.Id,
						UserId:     editor.UserId,
						Permission: int64(m.PERMISSION_ADMIN),
					}}
					return nil
				})

				err := UpdateTeam(&editor, &updateTeamCmd)
				So(teamUpdatedCallback(), ShouldBeTrue)
				So(err, ShouldBeNil)
			})
		})

		Convey("Given an editor and a team in another org", func() {
			testTeamOtherOrg := m.Team{
				Id:    1,
				OrgId: 2,
			}

			Convey("Shouldn't be able to update the team", func() {
				cmd := m.UpdateTeamCommand{
					Id:    testTeamOtherOrg.Id,
					OrgId: testTeamOtherOrg.OrgId,
				}

				shouldNotUpdateTeam()
				bus.AddHandler("test", func(cmd *m.GetTeamMembersQuery) error {
					cmd.Result = []*m.TeamMemberDTO{{
						OrgId:      testTeamOtherOrg.OrgId,
						TeamId:     testTeamOtherOrg.Id,
						UserId:     editor.UserId,
						Permission: int64(m.PERMISSION_ADMIN),
					}}
					return nil
				})

				err := UpdateTeam(&editor, &cmd)
				So(err, ShouldEqual, m.ErrNotAllowedToUpdateTeamInDifferentOrg)
			})
		})

		Convey("Given an org admin and a team", func() {
			Convey("Should be able to update the team", func() {
				teamUpdatedCallback := updateTeamCalled()
				err := UpdateTeam(&admin, &updateTeamCmd)

				So(teamUpdatedCallback(), ShouldBeTrue)
				So(err, ShouldBeNil)
			})
		})
	})
}

func updateTeamCalled() func() bool {
	wasCalled := false
	bus.AddHandler("test", func(cmd *m.UpdateTeamCommand) error {
		wasCalled = true
		return nil
	})

	return func() bool { return wasCalled }
}

func shouldNotUpdateTeam() {
	bus.AddHandler("test", func(cmd *m.UpdateTeamCommand) error {
		return errors.New("UpdateTeamCommand not expected.")
	})

}
