package unified_test

import (
	"net/http"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestIntegrationCreate(t *testing.T) {
	testUser := &identity.StaticRequester{
		Type:           claims.TypeUser,
		Login:          "admin",
		UserID:         1,
		UserUID:        "u1",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // can do anything
	}

	t.Run("happy path: creates a new resource", func(t *testing.T) {
		// TODO: Make a Spanner-compatible test

		cfg := setting.NewCfg()
		tracer := tracing.NewNoopTracerService()
		db := sqlstore.NewTestStore(t)
		resourceDB, err := dbimpl.ProvideResourceDB(db, cfg, tracer)
		require.NoError(t, err, "resource db")

		backend, err := sql.NewBackend(sql.BackendOptions{
			DBProvider: resourceDB,
			Tracer:     tracer,
		})
		require.NoError(t, err, "sql backend")
		err = backend.Init(t.Context())
		require.NoError(t, err, "sql backend init")

		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: backend,
			Tracer:  tracer,
		})
		require.NoError(t, err, "resource server")

		ctx := request.WithNamespace(t.Context(), "default")
		request := &resource.CreateRequest{
			Key: &resource.ResourceKey{
				Namespace: "default",
				Group:     "test.grafana",
				Resource:  "Test",
				Name:      "test",
			},
			Value: []byte(`{"apiVersion":"test.grafana/v0alpha1","kind":"Test","metadata":{"name":"test","namespace":"default"}}`),
		}

		ctx = claims.WithAuthInfo(ctx, testUser)
		response, err := server.Create(ctx, request)
		require.NoError(t, err, "create resource")
		require.Nil(t, response.Error, "create resource response.Error")

		t.Run("gracefully handles resource already exists error", func(t *testing.T) {
			response, err := server.Create(ctx, request)
			require.NoError(t, err, "create resource")
			require.NotNil(t, response.GetError(), "create resource response.Error")
			assert.Equal(t, int32(http.StatusConflict), response.GetError().GetCode(), "create resource response.Error.Code")
			assert.Equal(t, string(metav1.StatusReasonAlreadyExists), response.GetError().GetReason(), "create resource response.Error.Reason")
			t.Logf("Error: %v", response.GetError()) // only prints on failure, so this is fine
		})
	})
}
