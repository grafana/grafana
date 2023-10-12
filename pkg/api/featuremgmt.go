package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetFeatureToggles(ctx *contextmodel.ReqContext) response.Response {
	cfg := hs.Cfg.FeatureManagement
	enabledFeatures := hs.Features.GetEnabled(ctx.Req.Context())

	// object being returned
	dtos := make([]featuremgmt.FeatureToggleDTO, 0)

	// loop through features an add features that should be visible to dtos
	for _, ft := range hs.Features.GetFlags() {
		if isFeatureHidden(ft, cfg.HiddenToggles) {
			continue
		}
		dto := featuremgmt.FeatureToggleDTO{
			Name:        ft.Name,
			Description: ft.Description,
			Enabled:     enabledFeatures[ft.Name],
			ReadOnly:    !isFeatureWriteable(ft, cfg.ReadOnlyToggles) || !isFeatureEditingAllowed(*hs.Cfg),
		}

		dtos = append(dtos, dto)
	}

	return response.JSON(http.StatusOK, dtos)
}

func (hs *HTTPServer) UpdateFeatureToggle(ctx *contextmodel.ReqContext) response.Response {
	featureMgmtCfg := hs.Cfg.FeatureManagement
	if !featureMgmtCfg.AllowEditing {
		return response.Error(http.StatusForbidden, "feature toggles are read-only", fmt.Errorf("feature toggles are configured to be read-only"))
	}

	if featureMgmtCfg.UpdateWebhook == "" {
		return response.Error(http.StatusInternalServerError, "feature toggles service is misconfigured", fmt.Errorf("[feature_management]update_webhook is not set"))
	}

	cmd := featuremgmt.UpdateFeatureTogglesCommand{}
	if err := web.Bind(ctx.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	payload := UpdatePayload{
		FeatureToggles: make(map[string]string, len(cmd.FeatureToggles)),
		User:           ctx.SignedInUser.Email,
	}

	for _, t := range cmd.FeatureToggles {
		// make sure flag exists, and only continue if flag is writeable
		if f, ok := hs.Features.LookupFlag(t.Name); ok && isFeatureWriteable(f, hs.Cfg.FeatureManagement.ReadOnlyToggles) {
			hs.log.Info("UpdateFeatureToggle: updating toggle", "toggle_name", t.Name, "enabled", t.Enabled, "username", ctx.SignedInUser.Login)
			payload.FeatureToggles[t.Name] = strconv.FormatBool(t.Enabled)
		} else {
			hs.log.Warn("UpdateFeatureToggle: invalid toggle passed in", "toggle_name", t.Name)
			return response.Error(http.StatusBadRequest, "invalid toggle passed in", fmt.Errorf("invalid toggle passed in: %s", t.Name))
		}
	}

	err := sendWebhookUpdate(featureMgmtCfg, payload, hs.log)
	if err != nil {
		hs.log.Error("UpdateFeatureToggle: Failed to perform webhook request", "error", err)
		return response.Respond(http.StatusBadRequest, "Failed to perform webhook request")
	}

	return response.Respond(http.StatusOK, "feature toggles updated successfully")
}

// isFeatureHidden returns whether a toggle should be hidden from the admin page.
// filters out statuses Unknown, Experimental, and Private Preview
func isFeatureHidden(flag featuremgmt.FeatureFlag, hideCfg map[string]struct{}) bool {
	if _, ok := hideCfg[flag.Name]; ok {
		return true
	}
	return flag.Stage == featuremgmt.FeatureStageUnknown || flag.Stage == featuremgmt.FeatureStageExperimental || flag.Stage == featuremgmt.FeatureStagePrivatePreview
}

// isFeatureWriteable returns whether a toggle on the admin page can be updated by the user.
// only allows writing of GA and Deprecated toggles, and excludes the feature toggle admin page toggle
func isFeatureWriteable(flag featuremgmt.FeatureFlag, readOnlyCfg map[string]struct{}) bool {
	if _, ok := readOnlyCfg[flag.Name]; ok {
		return false
	}
	if flag.Name == featuremgmt.FlagFeatureToggleAdminPage {
		return false
	}
	return flag.Stage == featuremgmt.FeatureStageGeneralAvailability || flag.Stage == featuremgmt.FeatureStageDeprecated
}

// isFeatureEditingAllowed checks if the backend is properly configured to allow feature toggle changes from the UI
func isFeatureEditingAllowed(cfg setting.Cfg) bool {
	return cfg.FeatureManagement.AllowEditing && cfg.FeatureManagement.UpdateWebhook != ""
}

type UpdatePayload struct {
	FeatureToggles map[string]string `json:"feature_toggles"`
	User           string            `json:"user"`
}

func sendWebhookUpdate(cfg setting.FeatureMgmtSettings, payload UpdatePayload, logger log.Logger) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, cfg.UpdateWebhook, bytes.NewBuffer(data))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.UpdateWebhookToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	if resp.StatusCode >= http.StatusBadRequest {
		if body, err := io.ReadAll(resp.Body); err != nil {
			return fmt.Errorf("SendWebhookUpdate failed with status=%d, error: %s", resp.StatusCode, string(body))
		} else {
			return fmt.Errorf("SendWebhookUpdate failed with status=%d, error: %w", resp.StatusCode, err)
		}
	}

	return nil
}
