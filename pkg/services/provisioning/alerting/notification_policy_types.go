package alerting

import (
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type NotificiationPolicyV1 struct {
	OrgID  values.Int64Value `json:"orgId" yaml:"orgId"`
	Policy definitions.Route `json:",inline" yaml:",inline"`
}

func (v1 *NotificiationPolicyV1) mapToModel() NotificiationPolicy {
	orgID := v1.OrgID.Value()
	if orgID < 1 {
		orgID = 1
	}
	// we don't need any further validation here as it's done by
	// the notification policy service
	return NotificiationPolicy{
		OrgID:  orgID,
		Policy: v1.Policy,
	}
}

type NotificiationPolicy struct {
	OrgID  int64
	Policy definitions.Route
}
