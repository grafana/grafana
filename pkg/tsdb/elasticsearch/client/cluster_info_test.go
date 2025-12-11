package es

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetClusterInfo(t *testing.T) {
	t.Run("Should successfully get cluster info", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			rw.Header().Set("Content-Type", "application/json")
			_, err := rw.Write([]byte(`{
				"name": "test-cluster",
				"cluster_name": "elasticsearch",
				"cluster_uuid": "abc123",
				"version": {
					"number": "8.0.0",
					"build_flavor": "default",
					"build_type": "tar",
					"build_hash": "abc123",
					"build_date": "2023-01-01T00:00:00.000Z",
					"build_snapshot": false,
					"lucene_version": "9.0.0"
				}
			}`))
			require.NoError(t, err)
		}))

		t.Cleanup(func() {
			ts.Close()
		})

		clusterInfo, err := GetClusterInfo(ts.Client(), ts.URL)

		require.NoError(t, err)
		require.NotNil(t, clusterInfo)
		assert.Equal(t, "default", clusterInfo.Version.BuildFlavor)
	})

	t.Run("Should successfully get serverless cluster info", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			rw.Header().Set("Content-Type", "application/json")
			_, err := rw.Write([]byte(`{
				"name": "serverless-cluster",
				"cluster_name": "elasticsearch",
				"cluster_uuid": "def456",
				"version": {
					"number": "8.11.0",
					"build_flavor": "serverless",
					"build_type": "docker",
					"build_hash": "def456",
					"build_date": "2023-11-01T00:00:00.000Z",
					"build_snapshot": false,
					"lucene_version": "9.8.0"
				}
			}`))
			require.NoError(t, err)
		}))

		t.Cleanup(func() {
			ts.Close()
		})

		clusterInfo, err := GetClusterInfo(ts.Client(), ts.URL)

		require.NoError(t, err)
		require.NotNil(t, clusterInfo)
		assert.Equal(t, "serverless", clusterInfo.Version.BuildFlavor)
		assert.True(t, clusterInfo.IsServerless())
	})

	t.Run("should return error when status code is not 200", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			rw.WriteHeader(http.StatusInternalServerError)
		}))

		clusterInfo, err := GetClusterInfo(ts.Client(), ts.URL)
		require.Error(t, err)
		require.Nil(t, clusterInfo)
		assert.Contains(t, err.Error(), "unexpected status code 500 getting ES cluster info")
	})

	t.Run("Should return error when HTTP request fails", func(t *testing.T) {
		clusterInfo, err := GetClusterInfo(http.DefaultClient, "http://invalid-url-that-does-not-exist.local:9999")

		require.Error(t, err)
		require.Nil(t, clusterInfo)
		assert.Contains(t, err.Error(), "error getting ES cluster info")
	})

	t.Run("Should return error when response body is invalid JSON", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			rw.Header().Set("Content-Type", "application/json")
			_, err := rw.Write([]byte(`{"invalid json`))
			require.NoError(t, err)
		}))

		t.Cleanup(func() {
			ts.Close()
		})

		clusterInfo, err := GetClusterInfo(ts.Client(), ts.URL)

		require.Error(t, err)
		require.Nil(t, clusterInfo)
		assert.Contains(t, err.Error(), "error decoding ES cluster info")
	})

	t.Run("Should handle empty version object", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			rw.Header().Set("Content-Type", "application/json")
			_, err := rw.Write([]byte(`{
				"name": "test-cluster",
				"version": {}
			}`))
			require.NoError(t, err)
		}))

		t.Cleanup(func() {
			ts.Close()
		})

		clusterInfo, err := GetClusterInfo(ts.Client(), ts.URL)

		require.NoError(t, err)
		require.NotNil(t, clusterInfo)
		assert.Equal(t, "", clusterInfo.Version.BuildFlavor)
		assert.False(t, clusterInfo.IsServerless())
	})

	t.Run("Should handle HTTP error status codes", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
			rw.WriteHeader(http.StatusUnauthorized)
			_, err := rw.Write([]byte(`{"error": "Unauthorized"}`))
			require.NoError(t, err)
		}))

		t.Cleanup(func() {
			ts.Close()
		})

		clusterInfo, err := GetClusterInfo(ts.Client(), ts.URL)

		require.NoError(t, err)
		require.NotNil(t, clusterInfo)
	})
}

func TestClusterInfo_IsServerless(t *testing.T) {
	t.Run("Should return true when build_flavor is serverless", func(t *testing.T) {
		clusterInfo := &ClusterInfo{}
		clusterInfo.Version.BuildFlavor = BuildFlavorServerless

		assert.True(t, clusterInfo.IsServerless())
	})

	t.Run("Should return false when build_flavor is default", func(t *testing.T) {
		clusterInfo := &ClusterInfo{}
		clusterInfo.Version.BuildFlavor = "default"

		assert.False(t, clusterInfo.IsServerless())
	})

	t.Run("Should return false when build_flavor is empty", func(t *testing.T) {
		clusterInfo := &ClusterInfo{}
		clusterInfo.Version.BuildFlavor = ""

		assert.False(t, clusterInfo.IsServerless())
	})

	t.Run("Should return false when build_flavor is unknown value", func(t *testing.T) {
		clusterInfo := &ClusterInfo{}
		clusterInfo.Version.BuildFlavor = "unknown"

		assert.False(t, clusterInfo.IsServerless())
	})

}
