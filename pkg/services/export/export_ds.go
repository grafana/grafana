package export

import (
	"fmt"
	"path/filepath"
	"sort"

	"github.com/grafana/grafana/pkg/services/datasources"
)

func exportDataSources(helper *commitHelper, job *gitExportJob) error {
	cmd := &datasources.GetDataSourcesQuery{
		OrgID: helper.orgID,
	}
	result, err := job.datasourceService.GetDataSources(helper.ctx, cmd)
	if err != nil {
		return nil
	}

	sort.SliceStable(result, func(i, j int) bool {
		return result[i].Created.After(result[j].Created)
	})

	for _, ds := range result {
		ds.OrgID = 0
		ds.Version = 0
		ds.SecureJsonData = map[string][]byte{
			"TODO": []byte("XXX"),
		}

		err := helper.add(commitOptions{
			body: []commitBody{
				{
					fpath: filepath.Join(helper.orgDir, "datasources", fmt.Sprintf("%s-ds.json", ds.UID)),
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
