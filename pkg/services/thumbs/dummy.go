package thumbs

import (
	"encoding/json"
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
		return &previewResponse{
			Code: 404,
		}
	}

	return &previewResponse{
		Path: p,
		Code: 200,
	}
}

func (r *renderStub) CrawlerCmd(cfg *crawlCmd) (json.RawMessage, error) {
	return nil, fmt.Errorf("just a dummy crawler")
}
