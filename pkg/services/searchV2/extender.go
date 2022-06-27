package searchV2

import (
	"github.com/blugelabs/bluge"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type ExtendDashboardFunc func(uid string, doc *bluge.Document) error
type FramerFunc func(field string, value []byte)

type QueryExtender interface {
	GetFramer(frame *data.Frame) FramerFunc
}

type DocumentExtender interface {
	GetDashboardExtender(orgID int64, uids ...string) ExtendDashboardFunc
}

type DashboardIndexExtender interface {
	GetDocumentExtender() DocumentExtender
	GetQueryExtender(query DashboardQuery) QueryExtender
}

type NoopExtender struct{}

func (n NoopExtender) GetDocumentExtender() DocumentExtender {
	return &NoopDocumentExtender{}
}

func (n NoopExtender) GetQueryExtender(query DashboardQuery) QueryExtender {
	return &NoopQueryExtender{}
}

type NoopDocumentExtender struct{}

func (n NoopDocumentExtender) GetDashboardExtender(_ int64, _ ...string) ExtendDashboardFunc {
	return func(uid string, doc *bluge.Document) error {
		return nil
	}
}

type NoopQueryExtender struct{}

func (n NoopQueryExtender) GetFramer(_ *data.Frame) FramerFunc {
	return func(field string, value []byte) {
		// really noop
	}
}
