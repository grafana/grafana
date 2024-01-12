package featureflags

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/apis/featureflags/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func (b *FeatureFlagAPIBuilder) handleResolvedEnabled(w http.ResponseWriter, r *http.Request) {
	enabled := b.features.GetEnabled(r.Context())
	err := json.NewEncoder(w).Encode(enabled)
	if err != nil {
		w.WriteHeader(500)
	}
}

func (b *FeatureFlagAPIBuilder) handleResolvedStatus(w http.ResponseWriter, r *http.Request) {
	state := v0alpha1.ResolvedToggleState{
		Toggles: map[string]v0alpha1.ToggleState{},
	}

	lookup := map[string]featuremgmt.FeatureFlag{}
	for _, f := range b.features.GetFlags() {
		name := f.Name
		lookup[name] = f
		if b.features.IsHiddenFromAdminPage(name) {
			state.Hidden = append(state.Hidden, name)
		} else if b.features.IsEditableFromAdminPage(name) {
			state.Editable = append(state.Editable, name)
		}
	}

	// Find runtime state
	for k, v := range b.features.GetEnabled(r.Context()) {
		t := v0alpha1.ToggleState{
			Enabled: v,
			Source:  "startup",
		}
		f, ok := lookup[k]
		if ok {
			if v && f.Expression == "true" {
				t.Source = "default"
			}
		} else {
			t.Warning = "unknown feature flag"
		}
		state.Toggles[k] = t
	}

	err := json.NewEncoder(w).Encode(state)
	if err != nil {
		w.WriteHeader(500)
	}
}

func (b *FeatureFlagAPIBuilder) handleResolvedUpdate(w http.ResponseWriter, r *http.Request) {
	_, _ = w.Write([]byte("TODO!!!! the webhook thing!!"))
}
