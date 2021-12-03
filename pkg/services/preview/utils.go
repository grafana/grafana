package preview

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
)

func getFilePath(root string, req *previewRequest) string {
	return filepath.Join(root, fmt.Sprintf("%s-%s-%s.png", req.UID, req.Size, req.Theme))
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
