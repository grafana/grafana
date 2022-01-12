package accesscontrol

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type filterTest struct {
	desc          string
	driverName    string
	sqlID         string
	action        string
	prefix        string
	permissions   []*Permission
	expectedQuery string
	expectedArgs  []interface{}
}

func TestFilter(t *testing.T) {
	tests := []filterTest{
		{
			desc:       "should produce datasource filter with sqlite driver",
			driverName: "sqlite3",
			sqlID:      "data_source.id",
			prefix:     "datasources",
			action:     "datasources:query",
			permissions: []*Permission{
				{Action: "datasources:query", Scope: "datasources:id:1"},
				{Action: "datasources:query", Scope: "datasources:id:2"},
				{Action: "datasources:query", Scope: "datasources:id:3"},
				{Action: "datasources:query", Scope: "datasources:id:8"},
				// Other permissions
				{Action: "datasources:write", Scope: "datasources:id:100"},
				{Action: "datasources:delete", Scope: "datasources:id:101"},
			},
			expectedQuery: `
		? || ':id:' || data_source.id IN (
			WITH t(scope) AS (
				VALUES (?), (?), (?), (?)
			)
			SELECT IIF(t.scope = '*' OR t.scope = ? || ':*' OR t.scope = ? || ':id:*', ? || ':id:' || data_source.id, t.scope) FROM t
		)
	`,
			expectedArgs: []interface{}{
				"datasources",
				"datasources:id:1",
				"datasources:id:2",
				"datasources:id:3",
				"datasources:id:8",
				"datasources",
				"datasources",
				"datasources",
			},
		},
		{
			desc:       "should produce dashboard filter with mysql driver",
			driverName: "mysql",
			sqlID:      "dashboard.id",
			prefix:     "dashboards",
			action:     "dashboards:read",
			permissions: []*Permission{
				{Action: "dashboards:read", Scope: "dashboards:id:1"},
				{Action: "dashboards:read", Scope: "dashboards:id:2"},
				{Action: "dashboards:read", Scope: "dashboards:id:5"},
				// Other permissions
				{Action: "dashboards:write", Scope: "dashboards:id:100"},
				{Action: "dashboards:delete", Scope: "dashboards:id:101"},
			},
			expectedQuery: `
		CONCAT(?, ':id:', dashboard.id) IN (
			SELECT IF(t.scope = '*' OR t.scope = CONCAT(?, ':*') OR t.scope = CONCAT(?, ':id:*'), CONCAT(?, ':id:', dashboard.id), t.scope) FROM
			(SELECT ? AS scope UNION ALL SELECT ? UNION ALL SELECT ?) AS t
		)
	`,
			expectedArgs: []interface{}{
				"dashboards",
				"dashboards",
				"dashboards",
				"dashboards",
				"dashboards:id:1",
				"dashboards:id:2",
				"dashboards:id:5",
			},
		},
		{
			desc:       "should produce user filter with postgres driver",
			driverName: "postgres",
			sqlID:      "user.id",
			prefix:     "users",
			action:     "users:read",
			permissions: []*Permission{
				{Action: "users:read", Scope: "users:id:1"},
				{Action: "users:read", Scope: "users:id:100"},
				// Other permissions
				{Action: "dashboards:write", Scope: "dashboards:id:100"},
				{Action: "dashboards:delete", Scope: "dashboards:id:101"},
			},
			expectedQuery: `
		CONCAT(?, ':id:', user.id) IN (
			SELECT
				CASE WHEN p.scope = '*' OR p.scope = CONCAT(?, ':*') OR p.scope = CONCAT(?, ':id:*') THEN CONCAT(?, ':id:', user.id)
				ELSE p.scope
	    		END
			FROM (VALUES (?), (?)) as p(scope)
		)
	`,
			expectedArgs: []interface{}{
				"users",
				"users",
				"users",
				"users",
				"users:id:1",
				"users:id:100",
			},
		},
	}

	// set sqlIDAcceptList before running tests
	sqlIDAcceptList = map[string]struct{}{
		"user.id":        {},
		"dashboard.id":   {},
		"data_source.id": {},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			query, args, err := Filter(
				context.Background(),
				FakeDriver{name: tt.driverName},
				tt.sqlID,
				tt.prefix,
				tt.action,
				&models.SignedInUser{OrgId: 1, Permissions: map[int64]map[string][]string{1: GroupScopesByAction(tt.permissions)}},
			)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedQuery, query)

			require.Len(t, args, len(tt.expectedArgs))
			for i := range tt.expectedArgs {
				assert.Equal(t, tt.expectedArgs[i], args[i])
			}
		})
	}
}

type filterDatasourcesTestCase struct {
	desc                string
	sqlID               string
	permissions         []*Permission
	expectedDataSources []string
	expectErr           bool
}

func TestFilter_Datasources(t *testing.T) {
	tests := []filterDatasourcesTestCase{
		{
			desc:  "expect all data sources to be returned",
			sqlID: "data_source.id",
			permissions: []*Permission{
				{Action: "datasources:read", Scope: "datasources:*"},
			},
			expectedDataSources: []string{"ds:1", "ds:2", "ds:3", "ds:4", "ds:5", "ds:6", "ds:7", "ds:8", "ds:9", "ds:10"},
		},
		{
			desc:                "expect no data sources to be returned",
			sqlID:               "data_source.id",
			permissions:         []*Permission{},
			expectedDataSources: []string{},
		},
		{
			desc:  "expect data sources with id 3, 7 and 8 to be returned",
			sqlID: "data_source.id",
			permissions: []*Permission{
				{Action: "datasources:read", Scope: "datasources:id:3"},
				{Action: "datasources:read", Scope: "datasources:id:7"},
				{Action: "datasources:read", Scope: "datasources:id:8"},
			},
			expectedDataSources: []string{"ds:3", "ds:7", "ds:8"},
		},
		{
			desc:  "expect error if sqlID is not in the accept list",
			sqlID: "other.id",
			permissions: []*Permission{
				{Action: "datasources:read", Scope: "datasources:id:3"},
				{Action: "datasources:read", Scope: "datasources:id:7"},
				{Action: "datasources:read", Scope: "datasources:id:8"},
			},
			expectedDataSources: []string{"ds:3", "ds:7", "ds:8"},
			expectErr:           true,
		},
	}

	// set sqlIDAcceptList before running tests
	sqlIDAcceptList = map[string]struct{}{
		"data_source.id": {},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store := sqlstore.InitTestDB(t)

			sess := store.NewSession(context.Background())
			defer sess.Close()

			// seed 10 data sources
			for i := 1; i <= 10; i++ {
				err := store.AddDataSource(context.Background(), &models.AddDataSourceCommand{Name: fmt.Sprintf("ds:%d", i)})
				require.NoError(t, err)
			}

			baseSql := `SELECT data_source.* FROM data_source WHERE`
			query, args, err := Filter(
				context.Background(),
				&FakeDriver{name: "sqlite3"},
				tt.sqlID,
				"datasources",
				"datasources:read",
				&models.SignedInUser{OrgId: 1, Permissions: map[int64]map[string][]string{1: GroupScopesByAction(tt.permissions)}},
			)

			if !tt.expectErr {
				require.NoError(t, err)
				var datasources []models.DataSource
				err = sess.SQL(baseSql+query, args...).Find(&datasources)
				require.NoError(t, err)

				assert.Len(t, datasources, len(tt.expectedDataSources))
				for i, ds := range datasources {
					assert.Equal(t, tt.expectedDataSources[i], ds.Name)
				}
			} else {
				require.Error(t, err)
			}
		})
	}
}

type FakeDriver struct {
	name string
}

func (f FakeDriver) DriverName() string {
	return f.name
}
