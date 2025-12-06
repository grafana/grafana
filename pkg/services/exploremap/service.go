package exploremap

import (
	"context"
)

type Service interface {
	Create(context.Context, *CreateExploreMapCommand) (*ExploreMap, error)
	Update(context.Context, *UpdateExploreMapCommand) (*ExploreMapDTO, error)
	Get(context.Context, *GetExploreMapByUIDQuery) (*ExploreMapDTO, error)
	List(context.Context, *GetExploreMapsQuery) (ExploreMaps, error)
	Delete(ctx context.Context, cmd *DeleteExploreMapCommand) error
}
