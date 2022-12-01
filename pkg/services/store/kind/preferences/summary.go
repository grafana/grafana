package preferences

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/kinds/preferences"
	"github.com/grafana/grafana/pkg/models"
)

func GetEntityKindInfo() models.EntityKindInfo {
	return models.EntityKindInfo{
		ID:   models.StandardKindPreferences,
		Name: "Preferences",
	}
}

func GetEntitySummaryBuilder() models.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.EntitySummary, []byte, error) {
		if uid != "default" {
			parts := strings.Split(uid, "-")
			if len(parts) != 2 {
				return nil, nil, fmt.Errorf("expecting UID: default, user-{#}, or team-{#}")
			}
			if !(parts[0] == "team" || parts[0] == "user") {
				return nil, nil, fmt.Errorf("expecting UID: default, user-{#}, or team-{#}")
			}
		}

		obj := &preferences.Preferences{}
		err := json.Unmarshal(body, obj)
		if err != nil {
			return nil, nil, err // unable to read object
		}

		summary := &models.EntitySummary{
			Kind: models.StandardKindPreferences,
			Name: uid, // team-${id} | user-${id}
			UID:  uid,
		}

		out, err := json.MarshalIndent(obj, "", "  ")
		return summary, out, err
	}
}
