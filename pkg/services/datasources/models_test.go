package datasources

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	datasourcesV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestUpdateDataSourceCommandBasicAuthUserPresence(t *testing.T) {
	for _, tc := range []struct {
		name     string
		body     string
		username string
		set      bool
	}{
		{name: "omitted", body: `{"name":"updated"}`},
		{name: "null", body: `{"name":"updated","basicAuthUser":null}`},
		{name: "empty", body: `{"name":"updated","basicAuthUser":""}`, set: true},
		{name: "nonempty", body: `{"name":"updated","basicAuthUser":"new-user"}`, username: "new-user", set: true},
		{name: "internal flag ignored", body: `{"name":"updated","BasicAuthUserSet":true}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var cmd UpdateDataSourceCommand
			require.NoError(t, json.Unmarshal([]byte(tc.body), &cmd))
			require.Equal(t, "updated", cmd.Name)
			require.Equal(t, tc.username, cmd.BasicAuthUser)
			require.Equal(t, tc.set, cmd.BasicAuthUserSet)
		})
	}
}

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

			ds := datasourcesV0.DataSource{
				Spec: datasourcesV0.UnstructuredSpec{
					Object: map[string]any{"jsonData": jsonData.MustMap()},
				},
			}

			actual := ds.Spec.KeepCookies()
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
