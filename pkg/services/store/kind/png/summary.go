package png

import (
	"bytes"
	"context"
	"image/png"
	"strings"

	"github.com/grafana/grafana/pkg/models"
)

func GetObjectKindInfo() models.ObjectKindInfo {
	return models.ObjectKindInfo{
		ID:            models.StandardKindPNG,
		Name:          "PNG",
		Description:   "PNG Image file",
		IsRaw:         true,
		FileExtension: "png",
		MimeType:      "image/png",
	}
}

// SVG sanitizer based on the rendering service
func GetObjectSummaryBuilder() models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		img, err := png.Decode(bytes.NewReader(body))
		if err != nil {
			return nil, nil, err
		}

		size := img.Bounds().Size()
		summary := &models.ObjectSummary{
			Kind: models.StandardKindSVG,
			Name: guessNameFromUID(uid),
			UID:  uid,
			Fields: map[string]interface{}{
				"width":  int64(size.X),
				"height": int64(size.Y),
			},
		}
		return summary, body, nil
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
