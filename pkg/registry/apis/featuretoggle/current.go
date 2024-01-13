package featuretoggle

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	startup := features.GetStartupFlags()
	warnings := features.GetWarning()
	for _, f := range features.GetFlags() {
		name := f.Name
		if features.IsHiddenFromAdminPage(name, true) {
			continue
		}

		toggle := v0alpha1.ToggleStatus{
			Name:        name,
			Description: f.Description, // simplify the UI changes
			Enabled:     state.Enabled[name],
			Writeable:   features.IsEditableFromAdminPage(name),
			Source:      "startup",
			Warning:     warnings[name],
		}
		if f.Expression == "true" && toggle.Enabled {
			toggle.Source = "default"
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

	current := getResolvedToggleState(r.Context(), b.features)
	request := v0alpha1.ResolvedToggleState{}
	err := web.Bind(r, &request)
	if err != nil {
		_, _ = w.Write([]byte("ERROR!!! " + err.Error()))
		return
	}

	changes, err := getChangedToggles(current, request)
	if err != nil {
		_, _ = w.Write([]byte("ERROR!!! " + err.Error()))
		return
	}

	for _, change := range changes {
		fmt.Printf("TODO: %v\n", change)
		_, _ = w.Write([]byte("TODO changes " + err.Error()))
		return
	}

	_, _ = w.Write([]byte("nothing... "))
}

// Look for changes
type changeToggle struct {
	current v0alpha1.ToggleStatus
	next    v0alpha1.ToggleStatus
}

func getChangedToggles(current v0alpha1.ResolvedToggleState, next v0alpha1.ResolvedToggleState) ([]changeToggle, error) {
	return nil, nil
}
