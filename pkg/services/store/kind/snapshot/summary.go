package snapshot

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

// The real object extends dashbaord with the three additional fields
type Model struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	DeleteKey   string `json:"deleteKey"`
	ExternalURL string `json:"externalURL"`
	Expires     int64  `json:"expires,omitempty"` // time that this expires
}

func GetObjectKindInfo() models.ObjectKindInfo {
	return models.ObjectKindInfo{
		ID:   models.StandardKindSnapshot,
		Name: "Snapshot",
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
			return nil, nil, fmt.Errorf("expected snapshot name")
		}
		if obj.DeleteKey == "" {
			return nil, nil, fmt.Errorf("expected delete key")
		}

		summary := &models.ObjectSummary{
			Kind:        models.StandardKindFolder,
			Name:        obj.Name,
			Description: obj.Description,
			UID:         uid,
			Fields: map[string]interface{}{
				"deleteKey":   obj.DeleteKey,
				"externalURL": obj.ExternalURL,
				"expires":     obj.Expires,
			},
		}

		// Keep the original body
		return summary, body, err
	}
}
