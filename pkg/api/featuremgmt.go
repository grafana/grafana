package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetFeatureToggles(ctx *contextmodel.ReqContext) response.Response {
	featureMgmtCfg := hs.Cfg.FeatureManagement

	features := hs.Features.GetFlags()
	enabledFeatures := hs.Features.GetEnabled(ctx.Req.Context())

	// public preview -> read-only
	// experimental & unknown & private preview -> hidden
	for i := 0; i < len(features); {
		ft := features[i]
		if _, ok := featureMgmtCfg.HiddenToggles[ft.Name]; ok ||
			ft.Stage == featuremgmt.FeatureStageExperimental || ft.Stage == featuremgmt.FeatureStageUnknown || ft.Stage == featuremgmt.FeatureStagePrivatePreview {
			features = append(features[:i], features[i+1:]...) // remove feature
			continue
		}
		if _, ok := featureMgmtCfg.ReadOnlyToggles[ft.Name]; ok || ft.Stage == featuremgmt.FeatureStagePublicPreview {
			features[i].ReadOnly = true
		}
		features[i].Enabled = enabledFeatures[ft.Name]
		i++
	}

	return response.JSON(http.StatusOK, features)
}

func (hs *HTTPServer) UpdateFeatureToggle(ctx *contextmodel.ReqContext) response.Response {
	featureMgmtCfg := hs.Cfg.FeatureManagement
	if !featureMgmtCfg.AllowEditing {
		return response.Error(http.StatusForbidden, "feature toggles are read-only", fmt.Errorf("feature toggles are read-only"))
	}

	if featureMgmtCfg.UpdateControllerUrl == "" {
		return response.Error(http.StatusForbidden, "feature toggles service is misconfigured", fmt.Errorf("update_controller_url is not set"))
	}

	cmd := featuremgmt.UpdateFeatureTogglesCommand{}
	if err := web.Bind(ctx.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	for _, t := range cmd.FeatureToggles {
		// make sure flag exists, and only allow editing if flag is GA or deprecated
		if f, ok := hs.Features.LookupFlag(t.Name); !ok || (f.Stage != featuremgmt.FeatureStageGeneralAvailability && f.Stage != featuremgmt.FeatureStageDeprecated) {
			hs.log.Warn("UpdateFeatureToggle: invalid toggle passed in", "toggle_name", t.Name)
			return response.Error(http.StatusBadRequest, "invalid toggle passed in", fmt.Errorf("invalid toggle passed in"))
		} else {
			// build payload for controller
		}
	}

	// post to featureMgmtCfg.UpdateControllerUrl and return response status

	return response.Success("feature toggles updated")
}
