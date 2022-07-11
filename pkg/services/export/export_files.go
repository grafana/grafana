package export

import (
	"fmt"
	"path"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
)

func exportFiles(helper *commitHelper, job *gitExportJob) error {
	fs := filestorage.NewDbStorage(log.New("grafanaStorageLogger"), job.sql, nil, fmt.Sprintf("/%d/", helper.orgID))

	paging := &filestorage.Paging{}
	for {
		rsp, err := fs.List(helper.ctx, "/resources", paging, &filestorage.ListOptions{
			WithFolders:  false, // ????
			Recursive:    true,
			WithContents: true,
		})
		if err != nil {
			return err
		}

		for _, f := range rsp.Files {
			if f.Size < 1 {
				continue
			}
			err = helper.add(commitOptions{
				body: []commitBody{{
					body:  f.Contents,
					fpath: path.Join(helper.orgDir, f.FullPath),
				}},
				comment: fmt.Sprintf("Adding: %s", path.Base(f.FullPath)),
				when:    f.Created,
			})
			if err != nil {
				return err
			}
		}

		paging.After = rsp.LastPath
		if !rsp.HasMore {
			break
		}
	}
	return nil
}
