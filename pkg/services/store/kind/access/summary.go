package access

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

func GetObjectKindInfo() models.ObjectKindInfo {
	return models.ObjectKindInfo{
		ID:   models.StandardKindFolderAccess,
		Name: "Access rules",
	}
}

func GetObjectSummaryBuilder() models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		obj := &FolderAccessRules{}
		err := json.Unmarshal(body, obj)
		if err != nil {
			return nil, nil, err // unable to read object
		}

		clean, err := Sanitize(*obj)
		if err != nil {
			return nil, nil, err // unable to read object
		}
		if len(clean.Rules) < 1 {
			return nil, nil, fmt.Errorf("expecting at least one rule")
		}

		summary := &models.ObjectSummary{
			Kind:        models.StandardKindFolderAccess,
			Name:        uid,
			Description: "", //obj.Description,
			UID:         uid,
		}

		// // Not necessary since we can audit from the table anyway
		// for _, rule := range obj.Rules {
		// 	summary.References = append(summary.References, &models.ObjectExternalReference{
		// 		Kind: "user/group/team",
		// 		UID:  rule.Who,
		// 	})
		// }

		out, err := json.MarshalIndent(clean, "", "  ")
		return summary, out, err
	}
}

func GetFolderAccessRules(kind string, body []byte) (*FolderAccessRules, error) {
	if kind != models.StandardKindFolderAccess {
		return nil, nil
	}
	obj := &FolderAccessRules{}
	err := json.Unmarshal(body, obj)
	return obj, err
}
