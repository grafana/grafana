package featuretoggle

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func getResolvedToggleState(ctx context.Context, features *featuremgmt.FeatureManager) v0alpha1.ResolvedToggleState {
	state := v0alpha1.ResolvedToggleState{
		TypeMeta: v1.TypeMeta{
			APIVersion: v0alpha1.APIVERSION,
			Kind:       "ResolvedToggleState",
		},
		Enabled: features.GetEnabled(ctx),
	}

	// Reference to the object that defined the values
	startupRef := &common.ObjectReference{
		Namespace: "system",
		Name:      "startup",
	}

	startup := features.GetStartupFlags()
	warnings := features.GetWarning()
	for _, f := range features.GetFlags() {
		name := f.Name
		if features.IsHiddenFromAdminPage(name, false) {
			continue
		}

		toggle := v0alpha1.ToggleStatus{
			Name:        name,
			Description: f.Description, // simplify the UI changes
			Enabled:     state.Enabled[name],
			Writeable:   features.IsEditableFromAdminPage(name),
			Source:      startupRef,
			Warning:     warnings[name],
		}
		if f.Expression == "true" && toggle.Enabled {
			toggle.Source = nil
		}
		_, inStartup := startup[name]
		if toggle.Enabled || toggle.Writeable || toggle.Warning != "" || inStartup {
			state.Toggles = append(state.Toggles, toggle)
		}
	}
	return state
}

func (b *FeatureFlagAPIBuilder) handleCurrentStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPatch {
		b.handlePatchCurrent(w, r)
		return
	}

	state := getResolvedToggleState(r.Context(), b.features)

	err := json.NewEncoder(w).Encode(state)
	if err != nil {
		w.WriteHeader(500)
	}
}

// NOTE: authz is already handled by the authorizer
func (b *FeatureFlagAPIBuilder) handlePatchCurrent(w http.ResponseWriter, r *http.Request) {
	if !b.features.IsFeatureEditingAllowed() {
		_, _ = w.Write([]byte("Feature editing is disabled"))
		return
	}

	ctx := r.Context()
	request := v0alpha1.ResolvedToggleState{}
	err := web.Bind(r, &request)
	if err != nil {
		_, _ = w.Write([]byte("ERROR!!! " + err.Error()))
		return
	}

	if len(request.Toggles) > 0 {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("can only patch the enabled"))
		return
	}

	changes := map[string]string{} // TODO would be nice to have this be a bool on the HG side
	for k, v := range request.Enabled {
		current := b.features.IsEnabled(ctx, k)
		if current != v {
			if !b.features.IsEditableFromAdminPage(k) {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte("can not edit toggle: " + k))
				return
			}
			changes[k] = strconv.FormatBool(v)
		}
	}

	if len(changes) == 0 {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	payload := featuremgmt.FeatureToggleWebhookPayload{
		FeatureToggles: changes,
		User:           "unknown",
	}
	reqCtx := contexthandler.FromContext(r.Context())
	if reqCtx != nil && reqCtx.SignedInUser != nil {
		payload.User = reqCtx.SignedInUser.Email
	}

	err = sendWebhookUpdate(b.features.Settings, payload)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("failed to perform webhook request: " + err.Error()))
		return
	}

	b.features.SetRestartRequired()

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("feature toggles updated successfully"))
}

func sendWebhookUpdate(cfg setting.FeatureMgmtSettings, payload featuremgmt.FeatureToggleWebhookPayload) error {
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
