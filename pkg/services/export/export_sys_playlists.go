package export

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/store/entity"
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

	for _, item := range res {
		playlist, err := job.playlistService.Get(helper.ctx, &playlist.GetPlaylistByUidQuery{
			UID:   item.UID,
			OrgId: helper.orgID,
		})
		if err != nil {
			return err
		}

		gitcmd.body = append(gitcmd.body, commitBody{
			fpath: filepath.Join(
				helper.orgDir,
				"entity",
				entity.StandardKindPlaylist,
				fmt.Sprintf("%s.json", playlist.Uid)),
			body: prettyJSON(playlist),
		})
	}

	return helper.add(gitcmd)
}
