package preferences

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/kinds/preferences"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

func GetEntityKindInfo() entity.EntityKindInfo {
	return entity.EntityKindInfo{
		ID:   entity.StandardKindPreferences,
		Name: "Preferences",
	}
}

func GetEntitySummaryBuilder() entity.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*entity.EntitySummary, []byte, error) {
		if uid != "default" {
			parts := strings.Split(uid, "-")
			if len(parts) != 2 {
				return nil, nil, fmt.Errorf("expecting UID: default, user-{#}, or team-{#}")
			}
			if !(parts[0] == "team" || parts[0] == "user") {
				return nil, nil, fmt.Errorf("expecting UID: default, user-{#}, or team-{#}")
			}
		}

		obj := &preferences.Spec{}
		err := json.Unmarshal(body, obj)
		if err != nil {
			return nil, nil, err // unable to read object
		}

		summary := &entity.EntitySummary{
			Kind: entity.StandardKindPreferences,
			Name: uid, // team-${id} | user-${id}
			UID:  uid,
		}

		if obj.HomeDashboardUID != nil && *obj.HomeDashboardUID != "" {
			summary.References = append(summary.References, &entity.EntityExternalReference{
				Family:     entity.StandardKindDashboard,
				Identifier: *obj.HomeDashboardUID,
			})
		}

		out, err := json.MarshalIndent(obj, "", "  ")
		return summary, out, err
	}
}
