package api

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestHTTPServer_Search(t *testing.T) {
	sc := setupHTTPServer(t, true, true)
	sc.initCtx.IsSignedIn = true
	sc.initCtx.SignedInUser = &models.SignedInUser{}
	sc.hs.SearchService = search.ProvideService(sc.cfg, sc.db.(*sqlstore.SQLStore))
	sc.acmock.GetUserPermissionsFunc = func(ctx context.Context, user *models.SignedInUser, options accesscontrol.Options) ([]*accesscontrol.Permission, error) {
		return []*accesscontrol.Permission{
			{Action: "folders:read", Scope: "folders:*"},
			{Action: "dashboards:read", Scope: "dashboards:*"},
		}, nil
	}

	t.Run("should attach access control metadata to response", func(t *testing.T) {
		recorder := callAPI(sc.server, http.MethodGet, "/api/search?accesscontrol=true", nil, t)
		assert.Equal(t, http.StatusOK, recorder.Code)
		fmt.Println(recorder.Body.String())
	})

	t.Run("should not attach access control metadata to response", func(t *testing.T) {

	})
}
