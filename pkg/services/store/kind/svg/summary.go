package svg

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
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
func GetObjectSummaryBuilder(allowUnsanitizedSvgUpload bool, renderer rendering.Service) models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		if !IsSVG(body) {
			return nil, nil, fmt.Errorf("invalid svg")
		}

		// When a renderer exists, we can return a sanitized version
		var sanitized []byte
		if renderer != nil {
			rsp, err := renderer.SanitizeSVG(ctx, &rendering.SanitizeSVGRequest{
				Content: body,
			})
			if err != nil && !allowUnsanitizedSvgUpload {
				return nil, nil, err
			}
			sanitized = rsp.Sanitized
		}
		if sanitized == nil {
			if !allowUnsanitizedSvgUpload {
				return nil, nil, fmt.Errorf("unable to sanitize svg")
			}
			sanitized = body
		}

		return &models.ObjectSummary{
			Kind: models.StandardKindSVG,
			Name: guessNameFromUID(uid),
			UID:  uid,
		}, sanitized, nil
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
