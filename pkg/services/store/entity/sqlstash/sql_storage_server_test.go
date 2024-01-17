package sqlstash

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// #TODO: fix import cycle
func TestCreate(t *testing.T) {
	entityDB, err := dbimpl.ProvideEntityDB(dbtest.NewFakeDB(), nil, featuremgmt.WithFeatures())
	require.NoError(t, err)
	s, err := ProvideSQLEntityServer(entityDB)
	require.NoError(t, err)

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
