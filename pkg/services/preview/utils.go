package preview

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
)

func getFilePath(root string, req *previewRequest) string {
	ext := "webp"
	if req.Size != PreviewSizeThumb {
		ext = "png"
	}
	return filepath.Join(root, fmt.Sprintf("%s-%s-%s.%s", req.UID, req.Size, req.Theme, ext))
}

func SavePNG(img image.Image, filename string) error {
	f, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer f.Close()
	if err := png.Encode(f, img); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return nil
}
