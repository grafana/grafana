package navbarpreferences

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

const userInDbName = "user_in_db"

func testScenario(t *testing.T, desc string, fn func(t *testing.T, sc scenarioContext)) {
	features := featuremgmt.WithFeatures(featuremgmt.FlagNewNavigation)
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		ctx := web.Context{Req: &http.Request{}}
		orgID := int64(1)
		role := models.ROLE_ADMIN
		sqlStore := sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{
			Features: features,
		})
		cfg := setting.NewCfg()
		cfg.IsFeatureToggleEnabled = features.IsEnabled
		service := NavbarPreferencesService{
			Cfg:      cfg,
			SQLStore: sqlStore,
		}
		service.Cfg.IsFeatureToggleEnabled = features.IsEnabled

		user := models.SignedInUser{
			UserId:     1,
			Name:       "Signed In User",
			Login:      "signed_in_user",
			Email:      "signed.in.user@test.com",
			OrgId:      orgID,
			OrgRole:    role,
			LastSeenAt: time.Now(),
		}

		// deliberate difference between signed in user and user in db to make it crystal clear
		// what to expect in the tests
		// In the real world these are identical
		cmd := models.CreateUserCommand{
			Email: "user.in.db@test.com",
			Name:  "User In DB",
			Login: userInDbName,
		}

		_, err := sqlStore.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		sc := scenarioContext{
			user:     user,
			ctx:      &ctx,
			service:  &service,
			sqlStore: sqlStore,
			reqContext: &models.ReqContext{
				Context:      &ctx,
				SignedInUser: &user,
			},
		}

		fn(t, sc)
	})
}

type scenarioContext struct {
	ctx        *web.Context
	service    *NavbarPreferencesService
	reqContext *models.ReqContext
	user       models.SignedInUser
	sqlStore   *sqlstore.SQLStore
}

func getCreateNavbarPreferenceCommand(navItemID string, hideFromNavbar bool) CreateNavbarPreferenceCommand {
	command := CreateNavbarPreferenceCommand{
		NavItemID:      navItemID,
		HideFromNavbar: hideFromNavbar,
	}

	return command
}

func mockRequestBody(v interface{}) io.ReadCloser {
	b, _ := json.Marshal(v)
	return io.NopCloser(bytes.NewReader(b))
}

func getCompareOptions() []cmp.Option {
	return []cmp.Option{
		cmp.Transformer("Time", func(in time.Time) int64 {
			return in.UTC().Unix()
		}),
	}
}

func validateAndUnMarshalResponse(t *testing.T, resp response.Response) NavbarPreferenceResponse {
	t.Helper()

	require.Equal(t, 200, resp.Status())

	var result = NavbarPreferenceResponse{}
	err := json.Unmarshal(resp.Body(), &result)
	require.NoError(t, err)

	return result
}
