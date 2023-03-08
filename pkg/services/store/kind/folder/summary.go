package folder

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

type Model struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

func GetEntityKindInfo() entity.EntityKindInfo {
	return entity.EntityKindInfo{
		ID:   entity.StandardKindFolder,
		Name: "Folder",
	}
}

func GetEntitySummaryBuilder() entity.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*entity.EntitySummary, []byte, error) {
		obj := &Model{}
		err := json.Unmarshal(body, obj)
		if err != nil {
			return nil, nil, err // unable to read object
		}

		if obj.Name == "" {
			obj.Name = store.GuessNameFromUID(uid)
		}

		summary := &entity.EntitySummary{
			Kind:        entity.StandardKindFolder,
			Name:        obj.Name,
			Description: obj.Description,
			UID:         uid,
		}

		out, err := json.MarshalIndent(obj, "", "  ")
		return summary, out, err
	}
}
