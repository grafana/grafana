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
		given map[string]interface{}
		want  []string
	}{
		{
			desc: "Usual json data with keepCookies",
			given: map[string]interface{}{
				"keepCookies": []string{"cookie2"},
			},
			want: []string{"cookie2"},
		},
		{
			desc: "Usual json data without kepCookies",
			given: map[string]interface{}{
				"something": "somethingelse",
			},
			want: []string(nil),
		},
		{
			desc: "Usual json data that has multiple values in keepCookies",
			given: map[string]interface{}{
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
