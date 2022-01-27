package accesscontrol_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type filterDatasourcesTestCase struct {
	desc                string
	sqlID               string
	permissions         []*accesscontrol.Permission
	expectedDataSources []string
	expectErr           bool
}

func TestFilter_Datasources(t *testing.T) {
	tests := []filterDatasourcesTestCase{
		{
			desc:  "expect all data sources to be returned",
			sqlID: "data_source.id",
			permissions: []*accesscontrol.Permission{
				{Action: "datasources:read", Scope: "datasources:*"},
			},
			expectedDataSources: []string{"ds:1", "ds:2", "ds:3", "ds:4", "ds:5", "ds:6", "ds:7", "ds:8", "ds:9", "ds:10"},
		},
		{
			desc:                "expect no data sources to be returned",
			sqlID:               "data_source.id",
			permissions:         []*accesscontrol.Permission{},
			expectedDataSources: []string{},
		},
		{
			desc:  "expect data sources with id 3, 7 and 8 to be returned",
			sqlID: "data_source.id",
			permissions: []*accesscontrol.Permission{
				{Action: "datasources:read", Scope: "datasources:id:3"},
				{Action: "datasources:read", Scope: "datasources:id:7"},
				{Action: "datasources:read", Scope: "datasources:id:8"},
			},
			expectedDataSources: []string{"ds:3", "ds:7", "ds:8"},
		},
		{
			desc:  "expect error if sqlID is not in the accept list",
			sqlID: "other.id",
			permissions: []*accesscontrol.Permission{
				{Action: "datasources:read", Scope: "datasources:id:3"},
				{Action: "datasources:read", Scope: "datasources:id:7"},
				{Action: "datasources:read", Scope: "datasources:id:8"},
			},
			expectedDataSources: []string{"ds:3", "ds:7", "ds:8"},
			expectErr:           true,
		},
	}

	// set sqlIDAcceptList before running tests
	restore := accesscontrol.SetAcceptListForTest(map[string]struct{}{
		"data_source.id": {},
	})
	defer restore()

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
			query, args, err := accesscontrol.Filter(
				context.Background(),
				tt.sqlID,
				"datasources",
				"datasources:read",
				&models.SignedInUser{OrgId: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}},
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
