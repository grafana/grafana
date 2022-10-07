package svg

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/store/kind"
)

func GetObjectKindInfo() models.ObjectKindInfo {
	return models.ObjectKindInfo{
		ID:            models.StandardKindSVG,
		Name:          "SVG",
		Description:   "Scalable Vector Graphics",
		IsRaw:         true,
		FileExtension: "svg",
		MimeType:      "image/svg+xml",
	}
}

// SVG sanitizer based on the rendering service
func GetObjectSummaryBuilder(renderer rendering.Service) models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		if !IsSVG(body) {
			return nil, nil, fmt.Errorf("invalid svg")
		}

		// When a renderer exists, we can return a sanitized version
		if renderer != nil {
			rsp, err := renderer.SanitizeSVG(ctx, &rendering.SanitizeSVGRequest{
				Content: body,
			})
			if err != nil {
				return nil, nil, err
			}
			body = rsp.Sanitized
		}
		return &models.ObjectSummary{
			Kind: models.StandardKindSVG,
			Name: kind.GuessNameFromUID(uid),
			UID:  uid,
		}, body, nil
	}
}
