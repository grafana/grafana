package thumbs

import (
	"fmt"
	"path/filepath"
)

func getFilePath(root string, req *previewRequest) string {
	ext := "webp"
	if req.Size != PreviewSizeThumb {
		ext = "png"
	}
	return filepath.Join(root, fmt.Sprintf("%s-%s-%s.%s", req.UID, req.Size, req.Theme, ext))
}
