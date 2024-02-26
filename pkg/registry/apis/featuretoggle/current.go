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

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/grafana/grafana/pkg/util/errutil/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

func (b *FeatureFlagAPIBuilder) getResolvedToggleState(ctx context.Context) v0alpha1.ResolvedToggleState {
	state := v0alpha1.ResolvedToggleState{
		TypeMeta: v1.TypeMeta{
			APIVersion: v0alpha1.APIVERSION,
			Kind:       "ResolvedToggleState",
		},
		Enabled:         b.features.GetEnabled(ctx),
		RestartRequired: b.features.IsRestartRequired(),
	}

	// Reference to the object that defined the values
	startupRef := &common.ObjectReference{
		Namespace: "system",
		Name:      "startup",
	}

	startup := b.features.GetStartupFlags()
	warnings := b.features.GetWarning()
	for _, f := range b.features.GetFlags() {
		name := f.Name
		if b.features.IsHiddenFromAdminPage(name, false) {
			continue
		}

		toggle := v0alpha1.ToggleStatus{
			Name:        name,
			Description: f.Description, // simplify the UI changes
			Stage:       f.Stage.String(),
			Enabled:     state.Enabled[name],
			Writeable:   b.features.IsEditableFromAdminPage(name),
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

		if toggle.Writeable {
			state.AllowEditing = true
		}
	}

	// Make sure the user can actually write values
	if state.AllowEditing {
		state.AllowEditing = b.features.IsFeatureEditingAllowed() && b.userCanWrite(ctx, nil)
	}
	return state
}

func (b *FeatureFlagAPIBuilder) userCanRead(ctx context.Context, u *user.SignedInUser) bool {
	if u == nil {
		u, _ = appcontext.User(ctx)
		if u == nil {
			return false
		}
	}
	ok, err := b.accessControl.Evaluate(ctx, u, ac.EvalPermission(ac.ActionFeatureManagementRead))
	return ok && err == nil
}

func (b *FeatureFlagAPIBuilder) userCanWrite(ctx context.Context, u *user.SignedInUser) bool {
	if u == nil {
		u, _ = appcontext.User(ctx)
		if u == nil {
			return false
		}
	}
	ok, err := b.accessControl.Evaluate(ctx, u, ac.EvalPermission(ac.ActionFeatureManagementWrite))
	return ok && err == nil
}

func (b *FeatureFlagAPIBuilder) handleCurrentStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPatch {
		b.handlePatchCurrent(w, r)
		return
	}

	// Check if the user can access toggle info
	ctx := r.Context()
	user, err := appcontext.User(ctx)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	if !b.userCanRead(ctx, user) {
		err = errutil.Unauthorized("featuretoggle.canNotRead",
			errutil.WithPublicMessage("missing read permission")).Errorf("user %s does not have read permissions", user.Login)
		errhttp.Write(ctx, err, w)
		return
	}

	// Write the state to the response body
	state := b.getResolvedToggleState(r.Context())
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(state)
}

// NOTE: authz is already handled by the authorizer
func (b *FeatureFlagAPIBuilder) handlePatchCurrent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !b.features.IsFeatureEditingAllowed() {
		err := errutil.Forbidden("featuretoggle.disabled",
			errutil.WithPublicMessage("feature toggles are read-only")).Errorf("feature toggles are not writeable due to missing configuration")
		errhttp.Write(ctx, err, w)
		return
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	if !b.userCanWrite(ctx, user) {
		err = errutil.Unauthorized("featuretoggle.canNotWrite",
			errutil.WithPublicMessage("missing write permission")).Errorf("user %s does not have write permissions", user.Login)
		errhttp.Write(ctx, err, w)
		return
	}

	request := v0alpha1.ResolvedToggleState{}
	err = web.Bind(r, &request)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	if len(request.Toggles) > 0 {
		err = errutil.BadRequest("featuretoggle.badRequest",
			errutil.WithPublicMessage("can only patch the enabled section")).Errorf("request payload included properties in the read-only Toggles section")
		errhttp.Write(ctx, err, w)
		return
	}

	changes := map[string]string{} // TODO would be nice to have this be a bool on the HG side
	for k, v := range request.Enabled {
		current := b.features.IsEnabled(ctx, k)
		if current != v {
			if !b.features.IsEditableFromAdminPage(k) {
				err = errutil.BadRequest("featuretoggle.badRequest",
					errutil.WithPublicMessage("invalid toggle passed in")).Errorf("can not edit toggle %s", k)
				errhttp.Write(ctx, err, w)
				w.WriteHeader(http.StatusBadRequest)
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
		User:           user.Email,
	}

	err = sendWebhookUpdate(b.features.Settings, payload)
	if err != nil && b.cfg.Env != setting.Dev {
		err = errutil.Internal("featuretoggle.webhookFailure", errutil.WithPublicMessage("an error occurred while updating feeature toggles")).Errorf("webhook error: %w", err)
		errhttp.Write(ctx, err, w)
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
