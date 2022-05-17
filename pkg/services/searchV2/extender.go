package searchV2

import (
	"github.com/blugelabs/bluge"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type NoopExtender struct{}

func (n NoopExtender) GetDocumentExtender(_ int64, _ []string) ExtendDocumentFunc {
	return func(uid string, doc *bluge.Document) error {
		return nil
	}
}

func (n NoopExtender) GetQueryExtender() QueryExtender {
	return &NoopQueryExtender{}
}

type NoopQueryExtender struct{}

func (n NoopQueryExtender) GetFramer(_ *data.Frame) FramerFunc {
	return func(field string, value []byte) bool {
		return true
	}
}
