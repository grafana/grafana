package kind

import "github.com/grafana/grafana/pkg/services/entity"

type DatasourceBody struct {
	// ...
}

// Where did it come from
type Datasource struct {
	entity.Entity

	Body DashboardBody
}
