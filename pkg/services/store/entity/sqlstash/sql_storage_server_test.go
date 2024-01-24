package sqlstash

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCreate(t *testing.T) {
	s := setUpTestServer(t)

	t.Run("entity with only Key and CreatedBy", func(t *testing.T) {
		key := "/playlist.grafana.app/playlists/default/set-minimum-uid"

		req := entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:       key,
				CreatedBy: "set-minimum-creator",
			},
		}

		resp, err := s.Create(context.Background(), &req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, entity.CreateEntityResponse_CREATED, resp.Status)
		require.Nil(t, resp.Error)
		// #TODO check that everything that needs to be set is set
		// #TODO switch expected and actual
		// require.Equal(t, req.Entity.Name, resp.Entity.Name) // everything from guid through name, key, etag, oriigin
		require.Equal(t, resp.Entity.Subresource, "")
		require.Equal(t, resp.Entity.GroupVersion, "")
		require.Equal(t, resp.Entity.Folder, "")
		// require.Nil(t, resp.Entity.Meta)
		// require.Equal(t, resp.Entity.Body, "")
		// require.Equal(t, resp.Entity.Status, "")
		require.Equal(t, resp.Entity.Title, "")
		require.Equal(t, resp.Entity.Size, int64(0))
		require.Equal(t, resp.Entity.CreatedAt, int64(0))
		require.Equal(t, resp.Entity.CreatedBy, "")
		require.Equal(t, resp.Entity.UpdatedAt, int64(0))
		require.Equal(t, resp.Entity.UpdatedBy, "")
		require.Equal(t, resp.Entity.Description, "")
		require.Equal(t, resp.Entity.Slug, "")
		require.Equal(t, resp.Entity.Message, "")
		// require.Equal(t, resp.Entity.Labels, "")
		// require.Equal(t, resp.Entity.Fields, "")
		// require.Equal(t, resp.Entity.Errors, "")

		read, err := s.Read(context.Background(), &entity.ReadEntityRequest{
			Key: key,
		})
		require.NoError(t, err)
		require.NotNil(t, read)
	})

	t.Run("entity with no CreatedBy", func(t *testing.T) {
		key := "/playlist.grafana.app/playlists/default/set-minimum"

		req := entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key: key,
			},
		}

		resp, err := s.Create(context.Background(), &req)
		require.Error(t, err)
		require.Nil(t, resp)
	})

	t.Run("entity with no Key", func(t *testing.T) {
		req := entity.CreateEntityRequest{
			Entity: &entity.Entity{
				CreatedBy: "entity-creator",
			},
		}

		resp, err := s.Create(context.Background(), &req)
		// #TODO figure out what error to check for exactly
		require.Error(t, err)
		// --
		// // #TODO figure out what to check for the next three requires
		require.NotNil(t, resp)
		require.Equal(t, entity.CreateEntityResponse_ERROR, resp.Status)
		require.Nil(t, resp.Error)
	})
}

func setUpTestServer(t *testing.T) entity.EntityStoreServer {
	// #TODO: figure out if this is the store we want to use
	sqlStore := db.InitTestDB(t)

	entityDB, err := dbimpl.ProvideEntityDB(
		sqlStore,
		setting.NewCfg(),
		featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorage))
	require.NoError(t, err)

	s, err := ProvideSQLEntityServer(entityDB)
	require.NoError(t, err)
	return s
}
