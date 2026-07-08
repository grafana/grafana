package api

import (
	"net/http"
	"sort"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/api/response"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	featuretoggleapi "github.com/grafana/grafana/pkg/services/featuremgmt/feature_toggle_api"
)

func (hs *HTTPServer) AdminGetFeatureToggles(c *contextmodel.ReqContext) response.Response {
	state, err := hs.getResolvedFeatureToggleState(c)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get feature toggles", err)
	}

	return response.JSON(http.StatusOK, state)
}

func (hs *HTTPServer) getResolvedFeatureToggleState(c *contextmodel.ReqContext) (featuretoggleapi.ResolvedToggleState, error) {
	features, err := featuremgmt.GetEmbeddedFeatureList()
	if err != nil {
		return featuretoggleapi.ResolvedToggleState{}, err
	}

	allowEditing, err := hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, ac.EvalPermission(ac.ActionFeatureManagementWrite))
	if err != nil {
		return featuretoggleapi.ResolvedToggleState{}, err
	}

	enabled := hs.Features.GetEnabled(c.Req.Context())
	enabledOnly := make(map[string]bool, len(enabled))
	for name, value := range enabled {
		if value {
			enabledOnly[name] = true
		}
	}

	toggles := make([]featuretoggleapi.ToggleStatus, 0, len(features.Items)+len(enabled))
	seen := make(map[string]bool, len(features.Items))

	for _, feature := range features.Items {
		name := feature.Name
		if name == "" {
			continue
		}

		seen[name] = true
		toggles = append(toggles, featuretoggleapi.ToggleStatus{
			Name:            name,
			Description:     feature.Spec.Description,
			Stage:           feature.Spec.Stage,
			Enabled:         enabled[name],
			Writeable:       false,
			FrontendOnly:    feature.Spec.FrontendOnly,
			RequiresRestart: feature.Spec.RequiresRestart,
			RequiresDevMode: feature.Spec.RequiresDevMode,
			Warning:         featureToggleWarning(feature.Spec),
		})
	}

	for name, value := range enabled {
		if seen[name] {
			continue
		}

		toggles = append(toggles, featuretoggleapi.ToggleStatus{
			Name:      name,
			Stage:     featuremgmt.FeatureStageUnknown.String(),
			Enabled:   value,
			Writeable: false,
			Warning:   "Configured feature toggle is not registered in this build.",
		})
	}

	sort.Slice(toggles, func(i, j int) bool {
		return toggles[i].Name < toggles[j].Name
	})

	return featuretoggleapi.ResolvedToggleState{
		TypeMeta: metav1.TypeMeta{
			Kind:       "ResolvedToggleState",
			APIVersion: featuretoggleapi.APIVERSION,
		},
		AllowEditing: allowEditing,
		Enabled:      enabledOnly,
		Toggles:      toggles,
	}, nil
}

func featureToggleWarning(spec featuretoggleapi.FeatureSpec) string {
	if spec.RequiresDevMode {
		return "Requires Grafana development mode."
	}

	return ""
}
