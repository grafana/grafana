package integrationtypeschema

import (
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

func NewStorage(namespacer request.NamespaceMapper) grafanarest.Storage {
	return &legacyStorage{
		namespacer:     namespacer,
		tableConverter: ResourceInfo.TableConverter(),
	}
}
