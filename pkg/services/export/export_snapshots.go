package export

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

func exportSnapshots(helper *commitHelper, job *gitExportJob) error {
	cmd := &dashboardsnapshots.GetDashboardSnapshotsQuery{
		OrgID:        helper.orgID,
		Limit:        500000,
		SignedInUser: nil,
	}
	if cmd.SignedInUser == nil {
		return fmt.Errorf("snapshots requires an admin user")
	}

	result, err := job.dashboardsnapshotsService.SearchDashboardSnapshots(helper.ctx, cmd)
	if err != nil {
		return err
	}

	if len(result) < 1 {
		return nil // nothing
	}

	gitcmd := commitOptions{
		when:    time.Now(),
		comment: "Export snapshots",
	}

	for _, snapshot := range result {
		gitcmd.body = append(gitcmd.body, commitBody{
			fpath: filepath.Join(helper.orgDir, "snapshot", fmt.Sprintf("%d-snapshot.json", snapshot.ID)),
			body:  prettyJSON(snapshot),
		})
	}

	return helper.add(gitcmd)
}
