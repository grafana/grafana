package folder

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store"
)

type Model struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

func GetEntityKindInfo() models.EntityKindInfo {
	return models.EntityKindInfo{
		ID:   models.StandardKindFolder,
		Name: "Folder",
	}
}

func GetEntitySummaryBuilder() models.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.EntitySummary, []byte, error) {
		obj := &Model{}
		err := json.Unmarshal(body, obj)
		if err != nil {
			return nil, nil, err // unable to read object
		}

		if obj.Name == "" {
			obj.Name = store.GuessNameFromUID(uid)
		}

		summary := &models.EntitySummary{
			Kind:        models.StandardKindFolder,
			Name:        obj.Name,
			Description: obj.Description,
			UID:         uid,
		}

		out, err := json.MarshalIndent(obj, "", "  ")
		return summary, out, err
	}
}
