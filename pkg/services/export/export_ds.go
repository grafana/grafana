package export

import (
	"fmt"
	"path/filepath"
	"sort"

	"github.com/grafana/grafana/pkg/services/datasources"
)

func exportDataSources(helper *commitHelper, job *gitExportJob) error {
	cmd := &datasources.GetDataSourcesQuery{
		OrgId: helper.orgID,
	}
	err := job.datasourceService.GetDataSources(helper.ctx, cmd)
	if err != nil {
		return nil
	}

	sort.SliceStable(cmd.Result, func(i, j int) bool {
		return cmd.Result[i].Created.After(cmd.Result[j].Created)
	})

	for _, ds := range cmd.Result {
		ds.OrgId = 0
		ds.Version = 0
		ds.SecureJsonData = map[string][]byte{
			"TODO": []byte("XXX"),
		}

		err := helper.add(commitOptions{
			body: []commitBody{
				{
					fpath: filepath.Join(helper.orgDir, "datasources", fmt.Sprintf("%s-ds.json", ds.Uid)),
					body:  prettyJSON(ds),
				},
			},
			when:    ds.Created,
			comment: fmt.Sprintf("Add datasource: %s", ds.Name),
		})
		if err != nil {
			return err
		}
	}

	return nil
}
