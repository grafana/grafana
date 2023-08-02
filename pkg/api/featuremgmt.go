package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func (hs *HTTPServer) GetFeatureToggles(ctx *contextmodel.ReqContext) response.Response {
	featureMgmtCfg := hs.Cfg.FeatureManagement

	features := hs.Features.GetFlags()
	enabledFeatures := hs.Features.GetEnabled(ctx.Req.Context())

	for i := 0; i < len(features); {
		ft := features[i]
		if _, ok := featureMgmtCfg.HiddenToggles[ft.Name]; ok {
			features = append(features[:i], features[i+1:]...) // remove feature
			continue
		}
		if _, ok := featureMgmtCfg.ReadOnlyToggles[ft.Name]; ok {
			features[i].ReadOnly = true
		}
		features[i].Enabled = enabledFeatures[ft.Name]
		i++
	}

	return response.JSON(http.StatusOK, features)
}
