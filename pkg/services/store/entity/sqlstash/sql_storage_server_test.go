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

// #TODO: convert to table test where we provide expected response entity and error don't read from the table if we expect non nil error
func TestCreate(t *testing.T) {
	s := setUpTestServer(t)

	t.Run("entity with only Key and CreatedBy", func(t *testing.T) {
		key := "/playlist.grafana.app/playlists/default/set-minimum-uid"
		createdBy := "set-minimum-creator"
		req := entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:       key,
				CreatedBy: createdBy,
			},
		}
		resp, err := s.Create(context.Background(), &req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, entity.CreateEntityResponse_CREATED, resp.Status)
		require.Nil(t, resp.Error)

		exp := entity.Entity{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: "default",
			Name:      "set-minimum-uid",
			Key:       key,
			CreatedBy: createdBy,
		}

		read, err := s.Read(context.Background(), &entity.ReadEntityRequest{
			Key: key,
		})
		require.NoError(t, err)
		require.NotNil(t, read)

		require.Greater(t, len(read.Guid), 0)
		// is there a predictable way to compare the new version with the previous one?
		// I seem to remember that they don't increment by 1.
		require.Greater(t, read.ResourceVersion, int64(0))
		require.Greater(t, len(read.ETag), 0)

		require.Equal(t, exp.Origin, read.Origin)
		require.Equal(t, exp.Group, read.Group)
		require.Equal(t, exp.Resource, read.Resource)
		require.Equal(t, exp.Namespace, read.Namespace)
		require.Equal(t, exp.Name, read.Name)
		require.Equal(t, exp.Subresource, read.Subresource)
		require.Equal(t, exp.GroupVersion, read.GroupVersion)
		require.Equal(t, exp.Key, read.Key)
		require.Equal(t, exp.Folder, read.Folder)
		require.Equal(t, exp.Meta, read.Meta)
		require.Equal(t, exp.Body, read.Body)
		require.Equal(t, exp.Status, read.Status)
		require.Equal(t, exp.Title, read.Title)
		require.Equal(t, exp.Size, read.Size)
		require.Equal(t, exp.CreatedAt, read.CreatedAt)
		require.Equal(t, exp.CreatedBy, read.CreatedBy)
		require.Equal(t, exp.UpdatedAt, read.UpdatedAt)
		require.Equal(t, exp.UpdatedBy, read.UpdatedBy)
		require.Equal(t, exp.Description, read.Description)
		require.Equal(t, exp.Slug, read.Slug)
		require.Equal(t, exp.Message, read.Message)
		require.Equal(t, exp.Labels, read.Labels)
		require.Equal(t, exp.Fields, read.Fields)
		require.Equal(t, exp.Errors, read.Errors)
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
		// entity.CreateEntityResponse_ERROR doesn't get set for the status in this case
	})

	t.Run("entity with no Key", func(t *testing.T) {
		req := entity.CreateEntityRequest{
			Entity: &entity.Entity{
				CreatedBy: "entity-creator",
			},
		}

		resp, err := s.Create(context.Background(), &req)
		require.Error(t, err)
		require.Equal(t, entity.CreateEntityResponse_ERROR, resp.Status)
		// Entity.Errors docs say "When errors exist" but it looks unused
	})
}

func setUpTestServer(t *testing.T) entity.EntityStoreServer {
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
