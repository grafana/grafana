package featuretoggle

import (
	"encoding/json"
	"net/http"
)

func (b *FeatureFlagAPIBuilder) handleManagerState(w http.ResponseWriter, r *http.Request) {
	state := b.features.GetState()

	err := json.NewEncoder(w).Encode(state)
	if err != nil {
		w.WriteHeader(500)
	}
}
