package recordingrule

import (
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// ConvertToK8sResource converts a domain recording rule into its v0alpha1
// resource representation. It is exported for reuse by the rule search handlers.
func ConvertToK8sResource(orgID int64, rule *ngmodels.AlertRule, provenance ngmodels.Provenance, namespaceMapper request.NamespaceMapper) (*model.RecordingRule, error) {
	return convertToK8sResource(orgID, rule, provenance, namespaceMapper)
}
