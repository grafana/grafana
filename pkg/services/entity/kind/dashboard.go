package kind

import "github.com/grafana/grafana-plugin-sdk-go/experimental/entity"

type DashboardBody = map[string]interface{}

// Where did it come from
type Dashboard struct {
	entity.ConcreteEntityBase

	Body DashboardBody `json:"body,omitempty"`
}
