package thumbs

import (
	"fmt"
	"github.com/grafana/grafana/pkg/models"
	"path/filepath"
)

func getFilePath(root string, req *previewRequest) string {
	ext := "webp"
	if req.Kind != models.ThumbnailKindDefault {
		ext = "png"
	}
	return filepath.Join(root, fmt.Sprintf("%s-%s-%s.%s", req.UID, req.Kind, req.Theme, ext))
}
