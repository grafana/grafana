package datasource

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResourceRequest(t *testing.T) {
	testCases := []struct {
		desc         string
		url          string
		error        bool
		expectedPath string
		expectedURL  string
	}{
		{
			desc:  "no resource path",
			url:   "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc",
			error: true,
		},
		{
			desc:         "root resource path",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource",
			expectedPath: "",
			expectedURL:  "",
		},
		{
			desc:         "root resource path",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource/",
			expectedPath: "",
			expectedURL:  "",
		},
		{
			desc:         "resource sub path",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource/test",
			expectedPath: "test",
			expectedURL:  "test",
		},
		{
			desc:         "resource sub path with colon",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource/test-*,*:test-*/_mapping",
			expectedPath: "test-*,*:test-*/_mapping",
			expectedURL:  "./test-%2A,%2A:test-%2A/_mapping",
		},
		{
			desc:         "resource sub path with query params",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource/test?k1=v1&k2=v2",
			expectedPath: "test",
			expectedURL:  "test?k1=v1&k2=v2",
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.url, nil)
			clonedReq, err := resourceRequest(req)

			if tc.error {
				require.Error(t, err)
				require.Nil(t, clonedReq)
			} else {
				require.NoError(t, err)
				require.NotNil(t, clonedReq)
				require.Equal(t, tc.expectedPath, clonedReq.URL.Path)
				require.Equal(t, tc.expectedURL, clonedReq.URL.String())
			}
		})
	}
}
