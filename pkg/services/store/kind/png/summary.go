package png

import (
	"bytes"
	"context"
	"image/png"

	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

func GetEntityKindInfo() entity.EntityKindInfo {
	return entity.EntityKindInfo{
		ID:            entity.StandardKindPNG,
		Name:          "PNG",
		Description:   "PNG Image file",
		IsRaw:         true,
		FileExtension: "png",
		MimeType:      "image/png",
	}
}

// SVG sanitizer based on the rendering service
func GetEntitySummaryBuilder() entity.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*entity.EntitySummary, []byte, error) {
		img, err := png.Decode(bytes.NewReader(body))
		if err != nil {
			return nil, nil, err
		}

		size := img.Bounds().Size()
		summary := &entity.EntitySummary{
			Kind: entity.StandardKindSVG,
			Name: store.GuessNameFromUID(uid),
			UID:  uid,
			Fields: map[string]interface{}{
				"width":  int64(size.X),
				"height": int64(size.Y),
			},
		}
		return summary, body, nil
	}
}
