package datasource

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasource "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

const (
	panelLimit = 100
)

type subDashboardPanelsREST struct {
	builder *DataSourceAPIBuilder
	dashSvc dashboards.DashboardService
}

var (
	_ = rest.Connecter(&subDashboardPanelsREST{})
	_ = rest.StorageMetadata(&subDashboardPanelsREST{})
)

func (r *subDashboardPanelsREST) New() runtime.Object {
	return &datasource.DashboardPanelResult{}
}

func (r *subDashboardPanelsREST) Destroy() {
}

func (r *subDashboardPanelsREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subDashboardPanelsREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subDashboardPanelsREST) ProducesObject(verb string) interface{} {
	return &datasource.DashboardPanelResult{}
}

func (r *subDashboardPanelsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subDashboardPanelsREST) Connect(ctx context.Context, dsUid string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		user, err := identity.GetRequester(req.Context())
		if err != nil {
			responder.Error(err)
			return
		}

		rsp := make([]datasource.DashboardPanelResult, 0)

		dashboards, err := r.dashSvc.GetAllDashboardsByOrgId(ctx, user.GetOrgID())
		if err != nil {
			responder.Error(err)
			return
		}

	outer:
		for _, dashboard := range dashboards {
			panels := dashboard.Data.Get("panels")
			panelsArr := panels.MustArray()

			for _, panel := range panelsArr {
				if len(rsp) >= panelLimit {
					break outer
				}

				panelJSON := simplejson.NewFromAny(panel)
				ds := panelJSON.Get("datasource")
				panelJSONStr, err := panelJSON.MarshalJSON()
				if err != nil {
					responder.Error(fmt.Errorf("failed to marshal panel JSON: %w", err))
					return
				}
				if ds.Get("uid").MustString() == dsUid {
					rsp = append(rsp, datasource.DashboardPanelResult{
						DashboardUID:  dashboard.UID,
						DashboardName: dashboard.Title,
						PanelID:       panelJSON.Get("id").MustInt(),
						PanelJSON:     string(panelJSONStr),
					})
				}
			}
		}

		responder.Object(http.StatusOK, &datasource.DashboardPanelResultList{
			Items: rsp,
		})
	}), nil
}
