package snapshot

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

func GetDeleteRoutes(service dashboardsnapshots.Service, defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	prefix := dashv0.SnapshotResourceInfo.GroupResource().Resource
	tags := []string{dashv0.SnapshotResourceInfo.GroupVersionKind().Kind}

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: prefix + "/delete/{deleteKey}",
				Spec: &spec3.PathProps{
					Description: "Delete snapshot by delete key",
					Delete: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        tags,
							OperationId: "deleteWithKey",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "deleteKey",
										In:          "path",
										Required:    true,
										Description: "unique key returned in create",
										Schema:      spec.StringProperty(),
									},
								},
							},
						},
					},
				},
				Handler: func(w http.ResponseWriter, r *http.Request) {
					ctx := r.Context()
					vars := mux.Vars(r)
					key := vars["deleteKey"]

					err := dashboardsnapshots.DeleteWithKey(ctx, key, service)
					if err != nil {
						errhttp.Write(ctx, fmt.Errorf("failed to delete external dashboard (%w)", err), w)
						return
					}
					_ = json.NewEncoder(w).Encode(&util.DynMap{
						"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches.",
					})
				},
			},
		}}
}
