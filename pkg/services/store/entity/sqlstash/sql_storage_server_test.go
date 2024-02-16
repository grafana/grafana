package sqlstash

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestCreate(t *testing.T) {
	s := setUpTestServer(t)

	tests := []struct {
		name             string
		ent              *entity.Entity
		errIsExpected    bool
		statusIsExpected bool
	}{
		{
			"request with key and entity creator",
			&entity.Entity{
				Group:     "playlist.grafana.app",
				Resource:  "playlists",
				Namespace: "default",
				Name:      "set-minimum-uid",
				Key:       "/playlist.grafana.app/playlists/default/set-minimum-uid",
				CreatedBy: "set-minimum-creator",
				Origin:    &entity.EntityOriginInfo{},
			},
			false,
			true,
		},
		{
			"request with no entity creator",
			&entity.Entity{
				Key: "/playlist.grafana.app/playlists/default/set-only-key",
			},
			true,
			false,
		},
		{
			"request with no key",
			&entity.Entity{
				CreatedBy: "entity-creator",
			},
			true,
			true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := entity.CreateEntityRequest{
				Entity: &entity.Entity{
					Key:       tc.ent.Key,
					CreatedBy: tc.ent.CreatedBy,
				},
			}
			resp, err := s.Create(context.Background(), &req)

			if tc.errIsExpected {
				require.Error(t, err)

				if tc.statusIsExpected {
					require.Equal(t, entity.CreateEntityResponse_ERROR, resp.Status)
				}

				return
			}

			require.Nil(t, err)
			require.Equal(t, entity.CreateEntityResponse_CREATED, resp.Status)
			require.NotNil(t, resp)
			require.Nil(t, resp.Error)

			read, err := s.Read(context.Background(), &entity.ReadEntityRequest{
				Key: tc.ent.Key,
			})
			require.NoError(t, err)
			require.NotNil(t, read)

			require.Greater(t, len(read.Guid), 0)
			require.Greater(t, read.ResourceVersion, int64(0))

			expectedETag := createContentsHash(tc.ent.Body, tc.ent.Meta, tc.ent.Status)
			require.Equal(t, expectedETag, read.ETag)
			require.Equal(t, tc.ent.Origin, read.Origin)
			require.Equal(t, tc.ent.Group, read.Group)
			require.Equal(t, tc.ent.Resource, read.Resource)
			require.Equal(t, tc.ent.Namespace, read.Namespace)
			require.Equal(t, tc.ent.Name, read.Name)
			require.Equal(t, tc.ent.Subresource, read.Subresource)
			require.Equal(t, tc.ent.GroupVersion, read.GroupVersion)
			require.Equal(t, tc.ent.Key, read.Key)
			require.Equal(t, tc.ent.Folder, read.Folder)
			require.Equal(t, tc.ent.Meta, read.Meta)
			require.Equal(t, tc.ent.Body, read.Body)
			require.Equal(t, tc.ent.Status, read.Status)
			require.Equal(t, tc.ent.Title, read.Title)
			require.Equal(t, tc.ent.Size, read.Size)
			require.Greater(t, read.CreatedAt, int64(0))
			require.Equal(t, tc.ent.CreatedBy, read.CreatedBy)
			require.Equal(t, tc.ent.UpdatedAt, read.UpdatedAt)
			require.Equal(t, tc.ent.UpdatedBy, read.UpdatedBy)
			require.Equal(t, tc.ent.Description, read.Description)
			require.Equal(t, tc.ent.Slug, read.Slug)
			require.Equal(t, tc.ent.Message, read.Message)
			require.Equal(t, tc.ent.Labels, read.Labels)
			require.Equal(t, tc.ent.Fields, read.Fields)
			require.Equal(t, tc.ent.Errors, read.Errors)
		})
	}
}

func TestList(t *testing.T) {
	s := setUpTestServer(t)

	tests := []struct {
		name string
		key  string

		errIsExpected bool
	}{
		{
			"request with key lister",
			"/playlist.grafana.app/playlists",
			false,
		},
		{
			"request with namespaced key lister",
			"/playlist.grafana.app/playlists/default",
			false,
		},
		{
			"request with specific item key lister",
			"/playlist.grafana.app/playlists/default/set-minimum-uid",
			false,
		},
	}

	entityToCreate := &entity.Entity{
		Group:     "playlist.grafana.app",
		Resource:  "playlists",
		Namespace: "default",
		Name:      "set-minimum-uid",
		Key:       "/playlist.grafana.app/playlists/default/set-minimum-uid",
		CreatedBy: "set-minimum-creator",
	}

	req := entity.CreateEntityRequest{
		Entity: entityToCreate,
	}
	_, err := s.Create(context.Background(), &req)
	require.Nil(t, err)

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := entity.EntityListRequest{
				Key: []string{tc.key},
			}
			ctx := appcontext.WithUser(context.Background(), &user.SignedInUser{UserID: 1})
			resp, err := s.List(ctx, &req)

			if tc.errIsExpected {
				require.Error(t, err)
				return
			}

			require.Nil(t, err)
			entityRead := resp.Results[0]
			require.Equal(t, entityToCreate.Group, entityRead.Group)
			require.Equal(t, entityToCreate.Resource, entityRead.Resource)
			require.Equal(t, entityToCreate.Namespace, entityRead.Namespace)
			require.Equal(t, entityToCreate.Name, entityRead.Name)
		})
	}
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
