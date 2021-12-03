package preview

import (
	"errors"
	"fmt"
	"image/color"
	"math/rand"
	"os"
	"path/filepath"

	"github.com/fogleman/gg"
)

type renderStub struct {
	root string // folder path
}

func newDummyRenderer(root string) dashRenderer {
	return &renderStub{
		root: root,
	}
}

func (r *renderStub) GetPreview(req *previewRequest) *previewResponse {
	p := getFilePath(r.root, req)
	if _, err := os.Stat(p); errors.Is(err, os.ErrNotExist) {
		return r.queueRender(p, req)
	}

	return &previewResponse{
		Path: p,
		Code: 200,
	}
}

func (r *renderStub) queueRender(p string, req *previewRequest) *previewResponse {
	go func() {
		err := renderDummyImage(p, req)
		if err != nil {
			fmt.Printf("error writing file")
		}
	}()

	return &previewResponse{
		Code: 202,
		Path: p,
	}
}

func renderDummyImage(p string, req *previewRequest) error {
	// make sure the folder exists
	err := os.MkdirAll(filepath.Dir(p), os.ModePerm)
	if err != nil {
		return err
	}

	width := 512
	height := width

	switch req.Size {
	case PreviewSizeLarge:
		width = 512
		height = width
	case PreviewSizeSquare:
		width = 200
		height = width
	case PreviewSizeTall:
		width = 512
		height = 500 + rand.Intn(500)
	}

	bg := color.RGBA{0xE0, 0xE0, 0xE0, 0xFF}
	fg := color.RGBA{0x20, 0x20, 0x20, 0xFF}

	alpha := uint8(0x20)

	if req.Theme == "dark" {
		tmp := fg
		fg = bg
		bg = tmp
		alpha = 0xD0

		bg.R = uint8(rand.Intn(100))
		bg.G = uint8(rand.Intn(100))
		bg.B = uint8(rand.Intn(100))
	} else {
		bg.R = uint8(rand.Intn(100) + 100)
		bg.G = uint8(rand.Intn(100) + 100)
		bg.B = uint8(rand.Intn(100) + 100)
	}

	dc := gg.NewContext(width, height) // canvas 1000px by 1000px

	dc.SetColor(bg)
	dc.Clear()

	dc.SetColor(color.RGBA{bg.R, bg.G, bg.B, alpha})
	dc.DrawRectangle(10, 10, float64(width-20), float64(height-20))
	dc.Fill()

	dc.SetColor(fg)
	dc.DrawString(filepath.Base(p), 10, 50)

	//dc.DrawRectangle(10, 10, float64(width-20), 20)
	dc.Fill()

	return dc.SavePNG(p) // save it
}
