package kind

import "github.com/grafana/grafana/pkg/services/entity"

type AlertRuleBody struct {
	// ...
}

// Where did it come from
type AlertRule struct {
	entity.Entity

	Body DashboardBody
}
