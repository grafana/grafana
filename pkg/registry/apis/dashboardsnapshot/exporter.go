package dashboardsnapshot

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"gocloud.dev/blob"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

type dashExportStatus struct {
	Count    int
	Index    int
	Started  int64
	Updated  int64
	Finished int64
	Error    string
}

type dashExporter struct {
	status dashExportStatus

	service dashboardsnapshots.Service
	sql     db.DB
}

func (d *dashExporter) getAPIRouteHandler() builder.APIRouteHandler {
	return builder.APIRouteHandler{
		Path: "admin/export",
		Spec: &spec3.PathProps{
			Summary:     "an example at the root level",
			Description: "longer description here?",
			Post: &spec3.Operation{
				OperationProps: spec3.OperationProps{
					Tags: []string{"export"},
					Responses: &spec3.Responses{
						ResponsesProps: spec3.ResponsesProps{
							StatusCodeResponses: map[int]*spec3.Response{
								200: {
									ResponseProps: spec3.ResponseProps{
										Content: map[string]*spec3.MediaType{
											"application/json": {},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		Handler: func(w http.ResponseWriter, r *http.Request) {
			// Only let it start once
			if d.status.Started == 0 {
				go d.doExport()
			}
			time.Sleep(time.Second)
			_ = json.NewEncoder(w).Encode(d.status)
		},
	}
}

// NO way to stop!!!!!!
func (d *dashExporter) doExport() {
	defer func() {
		d.status.Finished = time.Now().UnixMilli()
	}()
	d.status = dashExportStatus{
		Started: time.Now().UnixMilli(),
	}
	if d.sql == nil {
		d.status.Error = "missing dependencies"
		return
	}

	ctx := context.Background()
	keys := []string{}
	err := d.sql.GetSqlxSession().Select(ctx,
		&keys, "SELECT key FROM dashboard_snapshot ORDER BY id asc")
	if err != nil {
		d.status.Error = err.Error()
		return
	}
	d.status.Count = len(keys)

	bucket, err := blob.OpenBucket(ctx, "mem://?key=foo.txt&prefix=a/subfolder/")
	if err != nil {
		d.status.Error = err.Error()
		return
	}
	defer func() {
		_ = bucket.Close()
	}()

	for idx, key := range keys {
		d.status.Index = idx
		snap, err := d.service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
			Key: key,
		})
		if err != nil {
			d.status.Error = err.Error()
			return
		}

		dash, err := snap.Dashboard.ToDB()
		if err != nil {
			d.status.Error = err.Error()
			return
		}

		fmt.Printf("TODO, export: %s (len: %d)\n", snap.Key, len(dash))

		// w, err := bucket.NewWriter(ctx, "foo.txt", nil)
		// if err != nil {
		// 	d.status.Error = err.Error()
		// 	return
		// }

		time.Sleep(time.Second * 1)
		d.status.Updated = time.Now().UnixMilli()
	}
	fmt.Printf("done!\n")
}
