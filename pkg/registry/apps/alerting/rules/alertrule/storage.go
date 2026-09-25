package alertrule

import (
	"k8s.io/apiserver/pkg/registry/rest"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngalertaccesscontrol "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

func NewStorage(legacySvc provisioning.AlertRuleService, namespacer request.NamespaceMapper, ruleAccess *ngalertaccesscontrol.RuleService) grafanarest.Storage {
	return &legacyStorage{
		service:        legacySvc,
		namespacer:     namespacer,
		tableConverter: rest.NewDefaultTableConvertor(ResourceInfo.GroupResource()),
		ruleAccess:     ruleAccess,
	}
}
