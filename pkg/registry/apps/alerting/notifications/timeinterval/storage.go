package timeinterval

import (
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

func NewStorage(
	legacySvc TimeIntervalService,
	namespacer request.NamespaceMapper,
) grafanarest.Storage {
	return &legacyStorage{
		service:        legacySvc,
		namespacer:     namespacer,
		tableConverter: ResourceInfo.TableConverter(),
	}
}
