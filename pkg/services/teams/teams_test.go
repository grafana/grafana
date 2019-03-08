package teams

import (
	. "github.com/smartystreets/goconvey/convey"
	m "github.com/grafana/grafana/pkg/models"
)


func TestUpdateTeam(t *testing.T) {
	Convey("Updating a team as an editor", t, func() {
		Convey("Given an editor and a team he isn't a member of", func() {
			
			UpdateTeam(editor, m.UpdateTeamCommand{
		Id:    0,
		Name:  "",
		Email: "",
		OrgId: 0,
	})
		})

		// the editor should not be able to update the team if they aren't members of it

		fakeDash := m.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = false

		bus.AddHandler("test", func(query *m.GetDashboardsBySlugQuery) error {
			dashboards := []*m.Dashboard{fakeDash}
			query.Result = dashboards
			return nil
		})

		var getDashboardQueries []*m.GetDashboardQuery

		bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
			query.Result = fakeDash
			getDashboardQueries = append(getDashboardQueries, query)
			return nil
		})

		bus.AddHandler("test", func(query *m.IsDashboardProvisionedQuery) error {
