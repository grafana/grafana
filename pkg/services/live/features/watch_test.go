package features

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestParseWatchRqeust(t *testing.T) {
	userid := "userid" // dummy
	tests := []struct {
		testCase string
		channel  string
		userid   string // override

		// Expect
		gvr  schema.GroupVersionResource
		name string
		err  bool
	}{
		{
			testCase: "dashbaords",
			channel:  "watch/dashboard.grafana.app/v0alpha1/dashboards/userid",
			gvr: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
		},
		{
			testCase: "dashbaords with anme",
			channel:  "watch/dashboard.grafana.app/v0alpha1/dashboards=abc/userid",
			gvr: schema.GroupVersionResource{
				Group:    "dashboard.grafana.app",
				Version:  "v0alpha1",
				Resource: "dashboards",
			},
			name: "abc",
		},
		{
			testCase: "bad user id",
			channel:  "watch/dashboard.grafana.app/v0alpha1/dashboards/x",
			err:      true, // bad user id
		},
	}
	for _, tt := range tests {
		t.Run(tt.testCase, func(t *testing.T) {
			gvr, name, err := parseWatchRequest(tt.channel, first(tt.userid, userid))
			if tt.err {
				require.Error(t, err)
				return
			}
			require.Equal(t, tt.gvr, gvr)
			require.Equal(t, tt.name, name)
		})
	}
}

func first(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
