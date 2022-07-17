package kind

import "github.com/grafana/grafana/pkg/services/entity"

type DashboardBody struct {
	// ...
}

// Where did it come from
type Dashboard struct {
	entity.Entity

	Body DashboardBody
}
