package recordingrule

import (
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

func NewStorage(legacySvc provisioning.AlertRuleService, namespacer request.NamespaceMapper) grafanarest.Storage {
	return &legacyStorage{
		service:        legacySvc,
		namespacer:     namespacer,
		tableConverter: rest.NewDefaultTableConvertor(ResourceInfo.GroupResource()),
	}
}
