package export

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

func exportSnapshots(helper *commitHelper, job *gitExportJob) error {
	cmd := &dashboardsnapshots.GetDashboardSnapshotsQuery{
		OrgId:        helper.orgID,
		Limit:        500000,
		SignedInUser: nil,
	}
	if cmd.SignedInUser == nil {
		return fmt.Errorf("snapshots requires an admin user")
	}

	err := job.dashboardsnapshotsService.SearchDashboardSnapshots(helper.ctx, cmd)
	if err != nil {
		return err
	}

	if len(cmd.Result) < 1 {
		return nil // nothing
	}

	gitcmd := commitOptions{
		when:    time.Now(),
		comment: "Export snapshots",
	}

	for _, snapshot := range cmd.Result {
		gitcmd.body = append(gitcmd.body, commitBody{
			fpath: filepath.Join(helper.orgDir, "snapshot", fmt.Sprintf("%d-snapshot.json", snapshot.Id)),
			body:  prettyJSON(snapshot),
		})
	}

	return helper.add(gitcmd)
}
