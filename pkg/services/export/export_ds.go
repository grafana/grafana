package export

import (
	"fmt"
	"path/filepath"
	"sort"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
)

type dsLookup func(ref *extract.DataSourceRef) *extract.DataSourceRef

func exportDataSources(helper *commitHelper, job *gitExportJob) (dsLookup, error) {
	cmd := &datasources.GetDataSourcesQuery{
		OrgId: job.orgID,
	}
	err := job.sql.GetDataSources(helper.ctx, cmd)
	if err != nil {
		return nil, err
	}

	sort.SliceStable(cmd.Result, func(i, j int) bool {
		return cmd.Result[i].Created.After(cmd.Result[j].Created)
	})

	byUID := make(map[string]*extract.DataSourceRef, len(cmd.Result))
	byName := make(map[string]*extract.DataSourceRef, len(cmd.Result))
	for _, ds := range cmd.Result {
		ref := &extract.DataSourceRef{
			UID:  ds.Uid,
			Type: ds.Type,
		}
		byUID[ds.Uid] = ref
		byName[ds.Name] = ref
		ds.OrgId = 0
		ds.Version = 0

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
			return nil, err
		}
	}

	// Return the lookup function
	return func(ref *extract.DataSourceRef) *extract.DataSourceRef {
		if ref == nil || ref.UID == "" {
			return &extract.DataSourceRef{
				UID:  "default.uid",
				Type: "default.type",
			}
		}
		v, ok := byUID[ref.UID]
		if ok {
			return v
		}
		v, ok = byName[ref.UID]
		if ok {
			return v
		}
		return nil
	}, nil
}
