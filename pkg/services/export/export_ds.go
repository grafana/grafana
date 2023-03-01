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
	dataSources, err := job.datasourceService.GetDataSources(helper.ctx, cmd)
	if err != nil {
		return nil
	}

	sort.SliceStable(dataSources, func(i, j int) bool {
		return dataSources[i].Created.After(dataSources[j].Created)
	})

	for _, ds := range dataSources {
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
