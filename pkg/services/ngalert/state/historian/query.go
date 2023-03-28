package historian

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Querier represents the ability to query state history.
// TODO: This package also contains implementations of this interface.
// TODO: This type should be moved to the side of the consumer, when the consumer is created in the future. We add it here temporarily to more clearly define this package's interface.
type Querier interface {
	QueryStates(ctx context.Context, query models.HistoryQuery) (*data.Frame, error)
}
