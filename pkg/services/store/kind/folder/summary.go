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

func GetObjectKindInfo() models.ObjectKindInfo {
	return models.ObjectKindInfo{
		ID:   models.StandardKindFolder,
		Name: "Folder",
	}
}

func GetObjectSummaryBuilder() models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		obj := &Model{}
		err := json.Unmarshal(body, obj)
		if err != nil {
			return nil, nil, err // unable to read object
		}

		if obj.Name == "" {
			obj.Name = store.GuessNameFromUID(uid)
		}

		summary := &models.ObjectSummary{
			Kind:        models.StandardKindFolder,
			Name:        obj.Name,
			Description: obj.Description,
			UID:         uid,
		}

		out, err := json.MarshalIndent(obj, "", "  ")
		return summary, out, err
	}
}
