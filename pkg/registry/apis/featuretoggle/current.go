package featuretoggle

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1"
	"github.com/grafana/grafana/pkg/web"
)

func (b *FeatureFlagAPIBuilder) handleResolvedStatus(w http.ResponseWriter, r *http.Request) {
	state := v0alpha1.ResolvedToggleState{
		Enabled: b.features.GetEnabled(r.Context()),
	}
	startup := b.features.GetStartupFlags()
	warnings := b.features.GetWarning()
	for _, f := range b.features.GetFlags() {
		name := f.Name
		if b.features.IsHiddenFromAdminPage(name, true) {
			continue
		}

		toggle := v0alpha1.ToggleStatus{
			Name:        name,
			Description: f.Description, // simplify the UI changes
			Enabled:     state.Enabled[name],
			Writeable:   b.features.IsEditableFromAdminPage(name),
			Source:      "startup",
			Warning:     warnings[name],
		}
		if f.Expression == "true" && toggle.Enabled {
			toggle.Source = "default"
		}
		_, inStartup := startup[name]
		if toggle.Enabled || toggle.Writeable || toggle.Warning != "" || inStartup {
			state.Details = append(state.Details, toggle)
		}
	}

	err := json.NewEncoder(w).Encode(state)
	if err != nil {
		w.WriteHeader(500)
	}
}

// NOTE: authz is already handled by the authorizer
func (b *FeatureFlagAPIBuilder) handleResolvedUpdate(w http.ResponseWriter, r *http.Request) {
	if !b.features.IsFeatureEditingAllowed() {
		_, _ = w.Write([]byte("Feature editing is disabled"))
		return
	}

	request := map[string]bool{}
	err := web.Bind(r, &request)
	if err != nil {
		_, _ = w.Write([]byte("ERROR!!! " + err.Error()))
		return
	}

	// Check if we actually have to change anything
	ctx := r.Context()
	changes := map[string]bool{}
	for k, v := range changes {
		if b.features.IsEnabled(ctx, k) != v {
			changes[k] = v
		}

		if !b.features.IsEditableFromAdminPage(k) {
			_, _ = w.Write([]byte("not allowed to update flag: " + k))
			return
		}
	}
	if len(changes) < 1 {
		_, _ = w.Write([]byte("NOTHING TO CHANGE!!!"))
		return
	}

	// TODO!!!! actual webhook or local change
	err = json.NewEncoder(w).Encode(changes)
	if err != nil {
		w.WriteHeader(500)
	}
}
