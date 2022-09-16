package export

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/services/playlist"
)

func exportSystemPlaylists(helper *commitHelper, job *gitExportJob) error {
	cmd := &playlist.GetPlaylistsQuery{
		OrgId: helper.orgID,
		Limit: 500000,
	}
	res, err := job.playlistService.Search(helper.ctx, cmd)
	if err != nil {
		return err
	}

	if len(res) < 1 {
		return nil // nothing
	}

	gitcmd := commitOptions{
		when:    time.Now(),
		comment: "Export playlists",
	}

	for _, playlist := range res {
		// TODO: fix the playlist API so it returns the json we need :)

		gitcmd.body = append(gitcmd.body, commitBody{
			fpath: filepath.Join(helper.orgDir, "system", "playlists", fmt.Sprintf("%s-playlist.json", playlist.UID)),
			body:  prettyJSON(playlist),
		})
	}

	return helper.add(gitcmd)
}
