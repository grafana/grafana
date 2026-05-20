package datasources

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestAllowedCookies(t *testing.T) {
	testCases := []struct {
		desc  string
		given map[string]any
		want  []string
	}{
		{
			desc: "Usual json data with keepCookies",
			given: map[string]any{
				"keepCookies": []string{"cookie2"},
			},
			want: []string{"cookie2"},
		},
		{
			desc: "Usual json data without kepCookies",
			given: map[string]any{
				"something": "somethingelse",
			},
			want: []string(nil),
		},
		{
			desc: "Usual json data that has multiple values in keepCookies",
			given: map[string]any{
				"keepCookies": []string{"cookie1", "cookie2", "special[]"},
			},
			want: []string{"cookie1", "cookie2", "special[]"},
		},
	}

	for _, test := range testCases {
		t.Run(test.desc, func(t *testing.T) {
			jsonDataBytes, err := json.Marshal(&test.given)
			require.NoError(t, err)
			jsonData, err := simplejson.NewJson(jsonDataBytes)
			require.NoError(t, err)

			ds := DataSource{
				ID:       1235,
				JsonData: jsonData,
				UID:      "test",
			}

			actual := ds.AllowedCookies()
			assert.Equal(t, test.want, actual)
			assert.EqualValues(t, test.want, actual)
		})
	}
}

func TestTeamHTTPHeaders(t *testing.T) {
	testCases := []struct {
		desc  string
		given string
		want  *TeamHTTPHeaders
	}{
		{
			desc:  "Usual json data with teamHttpHeaders",
			given: `{"teamHttpHeaders": {"headers": {"101": [{"header": "X-CUSTOM-HEADER", "value": "foo"}]}}}`,
			want: &TeamHTTPHeaders{
				Headers: TeamHeaders{
					"101": {
						{Header: "X-CUSTOM-HEADER", LBACRule: "foo"},
					},
				},
			},
		},
		{
			desc:  "Json data without teamHttpHeaders",
			given: `{"foo": "bar"}`,
			want:  nil,
		},
	}

	for _, test := range testCases {
		t.Run(test.desc, func(t *testing.T) {
			jsonDataBytes := []byte(test.given)
			jsonData, err := simplejson.NewJson(jsonDataBytes)
			require.NoError(t, err)

			ds := DataSource{
				ID:       1235,
				JsonData: jsonData,
				UID:      "test",
			}

			actual, err := GetTeamHTTPHeaders(ds.JsonData)
			assert.NoError(t, err)
			assert.Equal(t, test.want, actual)
			assert.EqualValues(t, test.want, actual)
		})
	}
}

func TestIsSecureSocksDSProxyEnabled(t *testing.T) {
	testCases := []struct {
		desc string
		ds   *DataSource
		want bool
	}{
		{
			desc: "Empty json",
			ds: &DataSource{
				JsonData: simplejson.New(),
			},
			want: false,
		},
		{
			desc: "Json with enableSecureSocksProxy",
			ds: &DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"enableSecureSocksProxy": true,
				}),
			},
			want: true,
		},
		{
			desc: "Json with string enableSecureSocksProxy",
			ds: &DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"enableSecureSocksProxy": "true",
				}),
			},
			want: false,
		},
		{
			desc: "Json with enableSecureSocksProxy false",
			ds: &DataSource{
				JsonData: simplejson.NewFromAny(map[string]interface{}{
					"enableSecureSocksProxy": false,
				}),
			},
			want: false,
		},
		{
			desc: "Json with no json data",
			ds:   &DataSource{},
			want: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			actual := tc.ds.IsSecureSocksDSProxyEnabled()
			assert.Equal(t, tc.want, actual)
		})
	}
}

func TestParseAllowedTeams(t *testing.T) {
	testCases := []struct {
		desc     string
		ds       *DataSource
		expected []TeamAccessRule
	}{
		{
			desc:     "empty allowed teams",
			ds:       &DataSource{AllowedTeams: ""},
			expected: nil,
		},
		{
			desc:     "valid single team with Admin permission",
			ds:       &DataSource{AllowedTeams: "1:Admin"},
			expected: []TeamAccessRule{{TeamID: 1, Permission: TeamPermissionAdmin}},
		},
		{
			desc:     "valid single team with Member permission",
			ds:       &DataSource{AllowedTeams: "2:Member"},
			expected: []TeamAccessRule{{TeamID: 2, Permission: TeamPermissionMember}},
		},
		{
			desc:     "multiple teams with different permissions",
			ds:       &DataSource{AllowedTeams: "1:Admin,2:Member,3:Admin"},
			expected: []TeamAccessRule{
				{TeamID: 1, Permission: TeamPermissionAdmin},
				{TeamID: 2, Permission: TeamPermissionMember},
				{TeamID: 3, Permission: TeamPermissionAdmin},
			},
		},
		{
			desc:     "legacy format - no permission part defaults to Member",
			ds:       &DataSource{AllowedTeams: "1"},
			expected: []TeamAccessRule{{TeamID: 1, Permission: TeamPermissionMember}},
		},
		{
			desc:     "invalid permission value",
			ds:       &DataSource{AllowedTeams: "1:Invalid"},
			expected: []TeamAccessRule{},
		},
		{
			desc:     "invalid team ID",
			ds:       &DataSource{AllowedTeams: "abc:Admin"},
			expected: []TeamAccessRule{},
		},
		{
			desc:     "mixed valid and invalid entries",
			ds:       &DataSource{AllowedTeams: "1:Admin,invalid,2:Member"},
			expected: []TeamAccessRule{
				{TeamID: 1, Permission: TeamPermissionAdmin},
				{TeamID: 2, Permission: TeamPermissionMember},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			actual := tc.ds.ParseAllowedTeams()
			assert.Equal(t, tc.expected, actual)
		})
	}
}

func TestIsTeamAllowed(t *testing.T) {
	testCases := []struct {
		desc           string
		ds             *DataSource
		teamID         int64
		teamPermission TeamPermission
		expected       bool
	}{
		{
			desc:           "no restrictions - should allow",
			ds:             &DataSource{AllowedTeams: ""},
			teamID:         1,
			teamPermission: TeamPermissionAdmin,
			expected:       true,
		},
		{
			desc:           "team matches with Admin permission required and Admin provided",
			ds:             &DataSource{AllowedTeams: "1:Admin"},
			teamID:         1,
			teamPermission: TeamPermissionAdmin,
			expected:       true,
		},
		{
			desc:           "team matches with Admin permission required but Member provided",
			ds:             &DataSource{AllowedTeams: "1:Admin"},
			teamID:         1,
			teamPermission: TeamPermissionMember,
			expected:       false,
		},
		{
			desc:           "team matches with Member permission required and Member provided",
			ds:             &DataSource{AllowedTeams: "2:Member"},
			teamID:         2,
			teamPermission: TeamPermissionMember,
			expected:       true,
		},
		{
			desc:           "team matches with Member permission required but Admin provided",
			ds:             &DataSource{AllowedTeams: "2:Member"},
			teamID:         2,
			teamPermission: TeamPermissionAdmin,
			expected:       false,
		},
		{
			desc:           "multiple teams - first match",
			ds:             &DataSource{AllowedTeams: "1:Admin,2:Member"},
			teamID:         1,
			teamPermission: TeamPermissionAdmin,
			expected:       true,
		},
		{
			desc:           "multiple teams - second match",
			ds:             &DataSource{AllowedTeams: "1:Admin,2:Member"},
			teamID:         2,
			teamPermission: TeamPermissionMember,
			expected:       true,
		},
		{
			desc:           "team not in allowed list",
			ds:             &DataSource{AllowedTeams: "1:Admin,2:Member"},
			teamID:         3,
			teamPermission: TeamPermissionAdmin,
			expected:       false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			actual := tc.ds.IsTeamAllowed(tc.teamID, tc.teamPermission)
			assert.Equal(t, tc.expected, actual)
		})
	}
}
