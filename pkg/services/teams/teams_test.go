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
		Convey("Given an editor and a team he isn't a member of", func() {
			editor := m.SignedInUser{
				UserId:  1,
				OrgId:   1,
				OrgRole: m.ROLE_EDITOR,
			}

			Convey("Should not be able to update the team", func() {
				cmd := m.UpdateTeamCommand{
					Id:    1,
					OrgId: editor.OrgId,
				}

				bus.AddHandler("test", func(cmd *m.UpdateTeamCommand) error {
					return errors.New("Editor not allowed to update team.")
				})
				bus.AddHandler("test", func(cmd *m.GetTeamMembersQuery) error {
					cmd.Result = []*m.TeamMemberDTO{}
					return nil
				})

				err := UpdateTeam(editor, &cmd)

				So(err, ShouldEqual, m.ErrNotAllowedToUpdateTeam)
			})
		})

		Convey("Given an editor and a team he is a member of", func() {
			editor := m.SignedInUser{
				UserId:  1,
				OrgId:   1,
				OrgRole: m.ROLE_EDITOR,
			}

			testTeam := m.Team{
				Id:    1,
				OrgId: 1,
			}

			Convey("Should be able to update the team", func() {
				cmd := m.UpdateTeamCommand{
					Id:    testTeam.Id,
					OrgId: testTeam.OrgId,
				}

				teamUpdated := false

				bus.AddHandler("test", func(cmd *m.UpdateTeamCommand) error {
					teamUpdated = true
					return nil
				})

				bus.AddHandler("test", func(cmd *m.GetTeamMembersQuery) error {
					cmd.Result = []*m.TeamMemberDTO{{
						OrgId:      testTeam.OrgId,
						TeamId:     testTeam.Id,
						UserId:     editor.UserId,
						Permission: int64(m.PERMISSION_ADMIN),
					}}
					return nil
				})

				err := UpdateTeam(editor, &cmd)

				So(teamUpdated, ShouldBeTrue)
				So(err, ShouldBeNil)
			})
		})

		Convey("Given an editor and a team in another org", func() {
			editor := m.SignedInUser{
				UserId:  1,
				OrgId:   1,
				OrgRole: m.ROLE_EDITOR,
			}

			testTeam := m.Team{
				Id:    1,
				OrgId: 2,
			}

			Convey("Shouldn't be able to update the team", func() {
				cmd := m.UpdateTeamCommand{
					Id:    testTeam.Id,
					OrgId: testTeam.OrgId,
				}

				bus.AddHandler("test", func(cmd *m.UpdateTeamCommand) error {
					return errors.New("Can't update a team in a different org.")
				})
				bus.AddHandler("test", func(cmd *m.GetTeamMembersQuery) error {
					cmd.Result = []*m.TeamMemberDTO{{
						OrgId:      testTeam.OrgId,
						TeamId:     testTeam.Id,
						UserId:     editor.UserId,
						Permission: int64(m.PERMISSION_ADMIN),
					}}
					return nil
				})

				err := UpdateTeam(editor, &cmd)

				So(err, ShouldEqual, m.ErrNotAllowedToUpdateTeamInDifferentOrg)
			})
		})

		Convey("Given an org admin and a team", func() {
			editor := m.SignedInUser{
				UserId:  1,
				OrgId:   1,
				OrgRole: m.ROLE_ADMIN,
			}

			testTeam := m.Team{
				Id:    1,
				OrgId: 1,
			}

			Convey("Should be able to update the team", func() {
				cmd := m.UpdateTeamCommand{
					Id:    testTeam.Id,
					OrgId: testTeam.OrgId,
				}

				teamUpdated := false

				bus.AddHandler("test", func(cmd *m.UpdateTeamCommand) error {
					teamUpdated = true
					return nil
				})

				err := UpdateTeam(editor, &cmd)

				So(teamUpdated, ShouldBeTrue)
				So(err, ShouldBeNil)
			})
		})
	})
}
