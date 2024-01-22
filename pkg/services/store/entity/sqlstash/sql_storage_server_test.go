package sqlstash

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCreate(t *testing.T) {
	s := setUpTestServer(t)

	tests := []struct {
		name string
	}{
		{
			"create",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			createdAt := metav1.Now()
			createdAtStr := createdAt.UTC().Format(time.RFC3339)

			updatedAt := createdAt.Add(time.Hour)
			updatedAtStr := updatedAt.UTC().Format(time.RFC3339)

			resp, err := s.Create(context.Background(), &entity.CreateEntityRequest{
				Entity: &entity.Entity{
					Key:             "/playlist.grafana.app/playlists/default/test-uid",
					GroupVersion:    "v0alpha1",
					Name:            "test-uid",
					Title:           "test-name",
					Guid:            "test-guid",
					Folder:          "test-folder",
					CreatedBy:       "test-created-by",
					CreatedAt:       createdAt.UnixMilli(),
					UpdatedAt:       updatedAt.UnixMilli(),
					UpdatedBy:       "test-updated-by",
					Slug:            "test-slug",
					Origin:          &entity.EntityOriginInfo{},
					Labels:          map[string]string{"label1": "value1", "label2": "value2"},
					Meta:            []byte(fmt.Sprintf(`{"metadata":{"name":"test-name","uid":"test-uid","resourceVersion":"1","creationTimestamp":%q,"labels":{"label1":"value1","label2":"value2"},"annotations":{"grafana.app/createdBy":"test-created-by","grafana.app/folder":"test-folder","grafana.app/slug":"test-slug","grafana.app/updatedTimestamp":%q,"grafana.app/updatedBy":"test-updated-by"}}}`, createdAtStr, updatedAtStr)),
					Body:            []byte(fmt.Sprintf(`{"kind":"Playlist","apiVersion":"playlist.grafana.app/v0alpha1","metadata":{"name":"test-name","uid":"test-uid","resourceVersion":"1","creationTimestamp":%q,"labels":{"label1":"value1","label2":"value2"},"annotations":{"grafana.app/createdBy":"test-created-by","grafana.app/folder":"test-folder","grafana.app/slug":"test-slug","grafana.app/updatedBy":"test-updated-by","grafana.app/updatedTimestamp":%q}},"spec":{"title":"A playlist","interval":"5m","items":[{"type":"dashboard_by_tag","value":"panel-tests"},{"type":"dashboard_by_uid","value":"vmie2cmWz"}]}}`, createdAtStr, updatedAtStr)),
					ResourceVersion: 1,
				},
			})
			require.NoError(t, err)
			require.NotNil(t, resp)
		})
	}
}

func setUpTestServer(t *testing.T) *sqlEntityServer {
	// #TODO: figure out if this is the store we want to use
	sqlStore := db.InitTestDB(t)

	entityDB, err := dbimpl.ProvideEntityDB(
		sqlStore,
		setting.NewCfg(),
		featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorage))
	require.NoError(t, err)

	// #TODO: this is required for now so that migrations can take place. Find another way?
	err = entityDB.Init()
	require.NoError(t, err)

	snode, err := snowflake.NewNode(rand.Int63n(1024))
	require.NoError(t, err)

	// #TODO: [temporary change] figure out how to provide session
	sess, err := entityDB.GetSession()
	require.NoError(t, err)

	return &sqlEntityServer{
		db:        entityDB,
		log:       log.New("sql-entity-server-test"),
		snowflake: snode,
		dialect:   sqlStore.Dialect,
		sess:      sess,
	}
}
