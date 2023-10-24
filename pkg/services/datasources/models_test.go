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
		want  TeamHTTPHeaders
	}{
		{
			desc:  "Usual json data with teamHttpHeaders",
			given: `{"teamHttpHeaders": {"101": [{"header": "X-CUSTOM-HEADER", "value": "foo"}]}}`,
			want: TeamHTTPHeaders{
				"101": {
					{Header: "X-CUSTOM-HEADER", Value: "foo"},
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

			actual, err := ds.TeamHTTPHeaders()
			assert.NoError(t, err)
			assert.Equal(t, test.want, actual)
			assert.EqualValues(t, test.want, actual)
		})
	}
}

// TeamHTTPHeaderValueRegexMatch returns a regex that can be used to check
func TestTeamHTTPHeaderValueRegexMatch(t *testing.T) {
	testcases := []struct {
		desc            string
		teamHeaderValue string
		want            bool
	}{
		{
			desc:            "Should be valid regex match for team headervalue",
			teamHeaderValue: `1234:{ name!="value",foo!~"bar" }`,
			want:            true,
		},
		{
			desc:            "Should return false for incorrect header value",
			teamHeaderValue: `1234:!="value",foo!~"bar" }`,
			want:            false,
		},
	}
	for _, tc := range testcases {
		t.Run(tc.desc, func(t *testing.T) {
			th := TeamHTTPHeader{
				Header: "X-Prom-Label-Policy",
				Value:  tc.teamHeaderValue,
			}
			assert.Equal(t, tc.want, th.TeamHTTPHeaderValueRegexMatch())
		})
	}
}
