package export

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func exportSystemPlaylists(helper *commitHelper, job *gitExportJob) error {
	cmd := &models.GetPlaylistsQuery{
		OrgId: helper.orgID,
		Limit: 500000,
	}
	err := job.sql.SearchPlaylists(helper.ctx, cmd)
	if err != nil {
		return err
	}

	if len(cmd.Result) < 1 {
		return nil // nothing
	}

	gitcmd := commitOptions{
		when:    time.Now(),
		comment: "Export playlists",
	}

	for _, playlist := range cmd.Result {
		// TODO: fix the playlist API so it returns the json we need :)

		gitcmd.body = append(gitcmd.body, commitBody{
			fpath: filepath.Join(helper.orgDir, "system", "playlists", fmt.Sprintf("%s-playlist.json", playlist.UID)),
			body:  prettyJSON(playlist),
		})
	}

	return helper.add(gitcmd)
}
