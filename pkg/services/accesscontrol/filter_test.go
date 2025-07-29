package accesscontrol_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

type filterDatasourcesTestCase struct {
	desc        string
	sqlID       string
	prefix      string
	actions     []string
	permissions map[string][]string

	expectedDataSources []string
	expectErr           bool
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationFilter_Datasources(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	tests := []filterDatasourcesTestCase{
		{
			desc:    "expect all data sources to be returned",
			sqlID:   "data_source.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read"},
			permissions: map[string][]string{
				"datasources:read": {"datasources:*"},
			},
			expectedDataSources: []string{"ds:1", "ds:2", "ds:3", "ds:4", "ds:5", "ds:6", "ds:7", "ds:8", "ds:9", "ds:10"},
		},
		{
			desc:    "expect all data sources for wildcard id scope to be returned",
			sqlID:   "data_source.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read"},
			permissions: map[string][]string{
				"datasources:read": {"datasources:id:*"},
			},
			expectedDataSources: []string{"ds:1", "ds:2", "ds:3", "ds:4", "ds:5", "ds:6", "ds:7", "ds:8", "ds:9", "ds:10"},
		},
		{
			desc:    "expect all data sources for wildcard scope to be returned",
			sqlID:   "data_source.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read"},
			permissions: map[string][]string{
				"datasources:read": {"*"},
			},
			expectedDataSources: []string{"ds:1", "ds:2", "ds:3", "ds:4", "ds:5", "ds:6", "ds:7", "ds:8", "ds:9", "ds:10"},
		},
		{
			desc:                "expect no data sources to be returned",
			sqlID:               "data_source.id",
			prefix:              "datasources:id:",
			actions:             []string{"datasources:read"},
			permissions:         map[string][]string{},
			expectedDataSources: []string{},
		},
		{
			desc:    "expect data sources with id 3, 7 and 8 to be returned",
			sqlID:   "data_source.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read"},
			permissions: map[string][]string{
				"datasources:read": {"datasources:id:3", "datasources:id:7", "datasources:id:8"},
			},
			expectedDataSources: []string{"ds:3", "ds:7", "ds:8"},
		},
		{
			desc:    "expect no data sources to be returned for malformed scope",
			sqlID:   "data_source.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read"},
			permissions: map[string][]string{
				"datasources:read": {"datasources:id:1*"},
			},
		},
		{
			desc:    "expect error if sqlID is not in the accept list",
			sqlID:   "other.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read"},
			permissions: map[string][]string{
				"datasources:read": {"datasources:id:3", "datasources:id:7", "datasources:id:8"},
			},
			expectErr: true,
		},
		{
			desc:    "expect data sources that users has several actions for",
			sqlID:   "data_source.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read", "datasources:write"},
			permissions: map[string][]string{
				"datasources:read":  {"datasources:id:3", "datasources:id:7", "datasources:id:8"},
				"datasources:write": {"datasources:id:3", "datasources:id:8"},
			},
			expectedDataSources: []string{"ds:3", "ds:8"},
			expectErr:           false,
		},
		{
			desc:    "expect data sources that users has several actions for",
			sqlID:   "data_source.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read", "datasources:write"},
			permissions: map[string][]string{
				"datasources:read":  {"datasources:id:3", "datasources:id:7", "datasources:id:8"},
				"datasources:write": {"datasources:*", "datasources:id:8"},
			},
			expectedDataSources: []string{"ds:3", "ds:7", "ds:8"},
			expectErr:           false,
		},
		{
			desc:    "expect no data sources when scopes does not match",
			sqlID:   "data_source.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read", "datasources:write"},
			permissions: map[string][]string{
				"datasources:read":  {"datasources:id:3", "datasources:id:7", "datasources:id:8"},
				"datasources:write": {"datasources:id:10"},
			},
			expectedDataSources: []string{},
			expectErr:           false,
		},
		{
			desc:    "expect to not crash if duplicates in the scope",
			sqlID:   "data_source.id",
			prefix:  "datasources:id:",
			actions: []string{"datasources:read", "datasources:write"},
			permissions: map[string][]string{
				"datasources:read":  {"datasources:id:3", "datasources:id:7", "datasources:id:8", "datasources:id:3", "datasources:id:8"},
				"datasources:write": {"datasources:id:3", "datasources:id:7"},
			},
			expectedDataSources: []string{"ds:3", "ds:7"},
			expectErr:           false,
		},
		{
			desc:    "expect to be filtered by uids",
			sqlID:   "data_source.uid",
			prefix:  "datasources:uid:",
			actions: []string{"datasources:read"},
			permissions: map[string][]string{
				"datasources:read": {"datasources:uid:uid3", "datasources:uid:uid7"},
			},
			expectedDataSources: []string{"ds:3", "ds:7"},
			expectErr:           false,
		},
	}

	// set sqlIDAcceptList before running tests
	restore := accesscontrol.SetAcceptListForTest(map[string]struct{}{
		"data_source.id":  {},
		"data_source.uid": {},
	})
	defer restore()

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store := db.InitTestDB(t)

			err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
				// seed 10 data sources
				for i := 1; i <= 10; i++ {
					dsStore := dsService.CreateStore(store, log.New("accesscontrol.test"))
					_, err := dsStore.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{Name: fmt.Sprintf("ds:%d", i), UID: fmt.Sprintf("uid%d", i)})
					require.NoError(t, err)
				}

				baseSql := `SELECT data_source.* FROM data_source WHERE`
				acFilter, err := accesscontrol.Filter(
					&user.SignedInUser{
						OrgID:       1,
						Permissions: map[int64]map[string][]string{1: tt.permissions},
					},
					tt.sqlID,
					tt.prefix,
					tt.actions...,
				)

				if !tt.expectErr {
					require.NoError(t, err)
					var datasources []datasources.DataSource
					err = sess.SQL(baseSql+acFilter.Where, acFilter.Args...).Find(&datasources)
					require.NoError(t, err)

					assert.Len(t, datasources, len(tt.expectedDataSources))
					for i, ds := range datasources {
						assert.Equal(t, tt.expectedDataSources[i], ds.Name)
					}
				} else {
					require.Error(t, err)
				}
				return nil
			})
			require.NoError(t, err)
		})
	}
}
