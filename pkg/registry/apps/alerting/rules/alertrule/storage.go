package alertrule

import (
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
)

func NewStorage(legacySvc legacy.LegacyRuleService, namespacer request.NamespaceMapper) grafanarest.Storage {
	return &legacyStorage{
		rules:          legacy.NewAlertRules(&legacySvc, namespacer),
		tableConverter: rest.NewDefaultTableConvertor(ResourceInfo.GroupResource()),
	}
}
