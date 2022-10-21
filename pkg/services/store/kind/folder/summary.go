package folder

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/grafana/grafana/pkg/models"
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
			obj.Name = guessNameFromUID(uid)
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

func guessNameFromUID(uid string) string {
	sidx := strings.LastIndex(uid, "/") + 1
	didx := strings.LastIndex(uid, ".")
	if didx > sidx && didx != sidx {
		return uid[sidx:didx]
	}
	if sidx > 0 {
		return uid[sidx:]
	}
	return uid
}
