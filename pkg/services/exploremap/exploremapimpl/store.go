package exploremapimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/exploremap"
)

type store interface {
	Insert(ctx context.Context, cmd *exploremap.CreateExploreMapCommand) (*exploremap.ExploreMap, error)
	Update(ctx context.Context, cmd *exploremap.UpdateExploreMapCommand) (*exploremap.ExploreMapDTO, error)
	Get(ctx context.Context, query *exploremap.GetExploreMapByUIDQuery) (*exploremap.ExploreMap, error)
	List(ctx context.Context, query *exploremap.GetExploreMapsQuery) (exploremap.ExploreMaps, error)
	Delete(ctx context.Context, cmd *exploremap.DeleteExploreMapCommand) error
}
