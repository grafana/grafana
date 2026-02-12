package appplugin

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"
	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

// settingsHandler implements GET /apis/{group}/v0alpha1/namespaces/{ns}/settings
// It mirrors the behaviour of the legacy GET /api/plugins/:pluginId/settings endpoint.
func (b *AppPluginAPIBuilder) settingsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract org ID from namespace (populated by go-restful via mux vars).
	ns := mux.Vars(r)["namespace"]
	nsInfo, err := claims.ParseNamespace(ns)
	if err != nil {
		http.Error(w, "invalid namespace", http.StatusBadRequest)
		return
	}
	orgID := nsInfo.OrgID

	plugin, exists := b.pluginStore.Plugin(ctx, b.pluginID)
	if !exists {
		http.Error(w, "plugin not found", http.StatusNotFound)
		return
	}

	dto := &dtos.PluginSetting{
		Name:             plugin.Name,
		Type:             string(plugin.Type),
		Id:               plugin.ID,
		Enabled:          plugin.AutoEnabled,
		Pinned:           plugin.AutoEnabled,
		AutoEnabled:      plugin.AutoEnabled,
		Module:           plugin.Module,
		BaseUrl:          plugin.BaseURL,
		Info:             plugin.Info,
		Includes:         plugin.Includes,
		Dependencies:     plugin.Dependencies,
		DefaultNavUrl:    plugin.DefaultNavURL,
		State:            plugin.State,
		Signature:        plugin.Signature,
		SignatureType:    plugin.SignatureType,
		SignatureOrg:     plugin.SignatureOrg,
		SecureJsonFields: map[string]bool{},
		AngularDetected:  plugin.Angular.Detected,
	}

	ps, err := b.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		PluginID: b.pluginID,
		OrgID:    orgID,
	})
	if err != nil {
		if !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			http.Error(w, "failed to get plugin settings", http.StatusInternalServerError)
			return
		}
	} else {
		dto.Enabled = ps.Enabled
		dto.Pinned = ps.Pinned
		dto.JsonData = ps.JSONData

		secureFields := map[string]bool{}
		for k, v := range ps.SecureJSONData {
			secureFields[k] = len(v) > 0
		}
		dto.SecureJsonFields = secureFields
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(dto); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}
