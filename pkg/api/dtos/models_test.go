package dtos

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGetUniqueDatasourceTypes(t *testing.T) {
	testcases := []struct {
		desc    string
		queries []*simplejson.Json
		result  []string
	}{
		{
			desc:   "can get unique datasource names",
			result: []string{"mysql", "prometheus"},
			queries: []*simplejson.Json{
				simplejson.NewFromAny(map[string]any{
					"datasource": map[string]any{
						"type": "prometheus",
						"uid":  "uid1",
					},
				}),
				simplejson.NewFromAny(map[string]any{
					"datasource": map[string]any{
						"type": "prometheus",
						"uid":  "uid2",
					},
				}),
				simplejson.NewFromAny(map[string]any{
					"datasource": map[string]any{
						"type": "mysql",
						"uid":  "uid3",
					},
				}),
			},
		},
		{
			desc:   "returns empty slice when datasources have no type property",
			result: []string{},
			queries: []*simplejson.Json{
				simplejson.NewFromAny(map[string]any{
					"datasource": map[string]any{
						"uid": "uid1",
					},
				}),
				simplejson.NewFromAny(map[string]any{
					"datasource": map[string]any{
						"uid": "uid3",
					},
				}),
			},
		},
	}

	for _, testcase := range testcases {
		t.Run(testcase.desc, func(t *testing.T) {
			metReq := MetricRequest{
				Queries: testcase.queries,
			}
			result := metReq.GetUniqueDatasourceTypes()
			sort.Strings(result)
			assert.Equal(t, testcase.result, result)
		})
	}
}

func TestIsHiddenUser(t *testing.T) {
	emptyHiddenUsers := map[string]struct{}{}
	hiddenUser := map[string]struct{}{
		"user": {},
	}

	testcases := []struct {
		desc         string
		userLogin    string
		signedInUser *user.SignedInUser
		hiddenUsers  map[string]struct{}
		expected     bool
	}{
		{
			desc:      "non-server admin user should see non-hidden user",
			userLogin: "user",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: false,
				Login:          "admin",
			},
			hiddenUsers: emptyHiddenUsers,
			expected:    false,
		},
		{
			desc:      "non-server admin user should not see hidden user",
			userLogin: "user",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: false,
				Login:          "admin",
			},
			hiddenUsers: hiddenUser,
			expected:    true,
		},
		{
			desc:      "non-server admin user should see himself, even if he's hidden",
			userLogin: "admin",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: false,
				Login:          "admin",
			},
			hiddenUsers: map[string]struct{}{
				"admin": {},
			},
			expected: false,
		},
		{
			desc:      "server admin user should see hidden user",
			userLogin: "user",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: true,
				Login:          "admin",
			},
			hiddenUsers: hiddenUser,
			expected:    false,
		},
		{
			desc:      "server admin user should see non-hidden user",
			userLogin: "user",
			signedInUser: &user.SignedInUser{
				IsGrafanaAdmin: true,
				Login:          "admin",
			},
			hiddenUsers: emptyHiddenUsers,
			expected:    false,
		},
	}

	for _, c := range testcases {
		t.Run(c.desc, func(t *testing.T) {
			isHidden := IsHiddenUser(c.userLogin, c.signedInUser, setting.ProvideService(&setting.Cfg{
				HiddenUsers: c.hiddenUsers,
			}))
			assert.Equal(t, c.expected, isHidden)
		})
	}
}
