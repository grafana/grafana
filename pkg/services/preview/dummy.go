package preview

import (
	"errors"
	"fmt"
	"os"
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
		fmt.Printf("todo? queue")
	}()

	return &previewResponse{
		Code: 202,
		Path: p,
	}
}
