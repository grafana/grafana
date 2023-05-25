package versions

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsGreaterThanOrEqual(t *testing.T) {
	testCases := []struct {
		newVersion    string
		stableVersion string
		expected      bool
	}{
		{newVersion: "9.0.0", stableVersion: "8.0.0", expected: true},
		{newVersion: "6.0.0", stableVersion: "6.0.0", expected: true},
		{newVersion: "7.0.0", stableVersion: "8.0.0", expected: false},
		{newVersion: "8.5.0-beta1", stableVersion: "8.0.0", expected: true},
		{newVersion: "8.5.0", stableVersion: "8.5.0-beta1", expected: true},
		{newVersion: "9.0.0.1", stableVersion: "9.0.0", expected: true},
		{newVersion: "9.0.0.2", stableVersion: "9.0.0.1", expected: true},
		{newVersion: "9.1.0", stableVersion: "9.0.0.1", expected: true},
		{newVersion: "9.1-0-beta1", stableVersion: "9.0.0.1", expected: true},
		{newVersion: "9.0.0.1", stableVersion: "9.0.1.1", expected: false},
		{newVersion: "9.0.1.1", stableVersion: "9.0.0.1", expected: true},
		{newVersion: "9.0.0.1", stableVersion: "9.0.0.1", expected: true},
		{newVersion: "7.0.0.1", stableVersion: "8.0.0", expected: false},
		{newVersion: "9.1-0-beta1", stableVersion: "9.1-0-beta2", expected: false},
		{newVersion: "9.1-0-beta3", stableVersion: "9.1-0-beta2", expected: true},
	}

	for _, tc := range testCases {
		name := fmt.Sprintf("newVersion %s greater than or equal stableVersion %s = %v", tc.newVersion, tc.stableVersion, tc.expected)
		t.Run(name, func(t *testing.T) {
			result, err := IsGreaterThanOrEqual(tc.newVersion, tc.stableVersion)
			require.NoError(t, err)
			require.Equal(t, tc.expected, result)
		})
	}
}

func TestGetLatestVersion(t *testing.T) {
	t.Run("it returns a version", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			response := VersionFromAPI{
				Version: "8.4.0",
			}
			jsonRes, err := json.Marshal(&response)
			require.NoError(t, err)
			_, err = w.Write(jsonRes)
			require.NoError(t, err)
		}))
		version, err := GetLatestVersion(server.URL)
		require.NoError(t, err)
		require.Equal(t, "8.4.0", version)
	})

	t.Run("it handles non 200 responses", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		_, err := GetLatestVersion(server.URL)
		require.Error(t, err)
	})
}
