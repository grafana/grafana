package legacypermissions_test

import (
	"context"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLoaderDiscardsPartialSQLResults(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, team := range []bool{false, true} {
		name := "permissions"
		if team {
			name = "teams"
		}
		t.Run(name, func(t *testing.T) {
			sql := db.NewTestStore(t)
			mockDB, mock, err := sqlmock.New()
			require.NoError(t, err)
			// Inject a driver failure while retaining the real store, dialect,
			// session handling and public loader seam.
			engineDB := sql.GetEngine().DB()
			original := engineDB.DB
			engineDB.DB = mockDB
			t.Cleanup(func() {
				engineDB.DB = original
				mock.ExpectClose()
				require.NoError(t, mockDB.Close())
				require.NoError(t, mock.ExpectationsWereMet())
			})
			loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(),
				resourcepermissions.NewActionSetService(), localcache.New(0, 0),
				loaderConfig(team), featuremgmt.WithFeatures(), &licensing.OSSLicensingService{}, nil,
			)
			requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer}
			boom := errors.New("driver lost connection after first row")
			columns := []string{"action", "scope"}
			rows := sqlmock.NewRows(columns).AddRow("users:read", "users:*").AddRow("users:create", "").RowError(1, boom)
			if team {
				requester.TeamIDs = []int64{3} //nolint:staticcheck // Exercise failures in the numeric RBAC team contribution.
				mock.ExpectQuery("SELECT").WillReturnRows(sqlmock.NewRows(columns)).RowsWillBeClosed()
				rows = sqlmock.NewRows(append(columns, "team_id")).AddRow("users:read", "users:*", 3).AddRow("users:create", "", 3).RowError(1, boom)
			}
			mock.ExpectQuery("SELECT").WillReturnRows(rows).RowsWillBeClosed()
			got, err := loader.GetUserPermissions(context.Background(), requester, ac.Options{})
			require.ErrorIs(t, err, boom)
			require.Nil(t, got)
		})
	}
}
