package api

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/setting"
)

// Note: This is a minimal example showing how to add feature toggles to the boot payload.
// Integrate with Grafana's actual frontend boot data code path (where the server renders JSON into the page).
func frontendSettingsHandler(w http.ResponseWriter, r *http.Request) {
	// Example existing boot data:
	boot := map[string]interface{}{
		"settings": map[string]interface{}{},
	}

	// Add our feature toggle into the front-end settings payload.
	settings := boot["settings"].(map[string]interface{})

	settings["featureToggles"] = map[string]interface{}{
		"default_sidebar_docked": setting.FeatureToggleConfig.DefaultSidebarDocked,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(boot)
}
