package gmsclient

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"
)

func Test_buildURL(t *testing.T) {
	t.Parallel()

	// Domain is required
	_, err := NewGMSClient(&setting.Cfg{
		CloudMigration: setting.CloudMigrationSettings{
			GMSDomain: "",
		},
	},
		http.DefaultClient,
	)
	require.Error(t, err)

	// Domain is required
	c, err := NewGMSClient(&setting.Cfg{
		CloudMigration: setting.CloudMigrationSettings{
			GMSDomain: "non-empty",
		},
	},
		http.DefaultClient,
	)
	require.NoError(t, err)
	client := c.(*gmsClientImpl)

	tests := []struct {
		description string
		domain      string
		clusterSlug string
		path        string
		expected    string
	}{
		{
			description: "domain starts with http://, should return domain",
			domain:      "http://some-domain:8080",
			clusterSlug: "anything",
			expected:    "http://some-domain:8080",
		},
		{
			description: "domain starts with https://, should return domain",
			domain:      "https://some-domain:8080",
			clusterSlug: "anything",
			expected:    "https://some-domain:8080",
		},
		{
			description: "domain starts with https://, should return domain",
			domain:      "https://some-domain:8080",
			clusterSlug: "anything",
			path:        "/test?foo=bar&baz=qax#fragment",
			expected:    "https://some-domain:8080/test?foo=bar&baz=qax#fragment",
		},
		{
			description: "domain doesn't start with http or https, should build a string using the domain and clusterSlug",
			domain:      "gms-dev",
			clusterSlug: "us-east-1",
			expected:    "https://cms-us-east-1.gms-dev/cloud-migrations",
		},
		{
			description: "it parses and escapes the path when building the URL",
			domain:      "gms-dev",
			clusterSlug: "use-east-1",
			path:        `/this//is//a/\very-Nice_páTh?x=/çç&y=/éé#aaaa`,
			expected:    "https://cms-use-east-1.gms-dev/cloud-migrations/this//is//a/%5Cvery-Nice_p%C3%A1Th?x=/çç&y=/éé#aaaa",
		},
	}
	for _, tt := range tests {
		t.Run(tt.description, func(t *testing.T) {
			client.cfg.CloudMigration.GMSDomain = tt.domain

			url, err := client.buildURL(tt.clusterSlug, tt.path)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, url)
		})
	}
}

func Test_handleGMSErrors(t *testing.T) {
	t.Parallel()

	c, err := NewGMSClient(&setting.Cfg{
		CloudMigration: setting.CloudMigrationSettings{
			GMSDomain: "http://some-domain:8080",
		},
	},
		http.DefaultClient,
	)
	require.NoError(t, err)
	client := c.(*gmsClientImpl)

	testscases := []struct {
		gmsResBody    []byte
		expectedError error
	}{
		{
			gmsResBody:    []byte(`{"message":"instance is unreachable, make sure the instance is running"}`),
			expectedError: cloudmigration.ErrInstanceUnreachable,
		},
		{
			gmsResBody:    []byte(`{"message":"checking if instance is reachable"}`),
			expectedError: cloudmigration.ErrInstanceRequestError,
		},
		{
			gmsResBody:    []byte(`{"message":"fetching instance by stack id 1234"}`),
			expectedError: cloudmigration.ErrInstanceRequestError,
		},
		{
			gmsResBody:    []byte(`{"status":"error","error":"authentication error: invalid token"}`),
			expectedError: cloudmigration.ErrTokenValidationFailure,
		},
		{
			gmsResBody:    []byte(""),
			expectedError: cloudmigration.ErrTokenValidationFailure,
		},
	}

	for _, tc := range testscases {
		resError := client.handleGMSErrors(tc.gmsResBody)
		require.ErrorIs(t, resError, tc.expectedError)
	}
}

func Test_ValidateKey(t *testing.T) {
	t.Parallel()

	t.Run("when the key is valid, it returns no error", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)

			auth := r.Header.Get("Authorization")
			require.Equal(t, fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken), auth)

			w.WriteHeader(http.StatusOK)
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:             server.URL,
				GMSValidateKeyTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		err := client.ValidateKey(ctx, session)
		require.NoError(t, err)
	})

	t.Run("when the key invalidated for any reason, it returns a token validation failure", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)

			auth := r.Header.Get("Authorization")
			require.Equal(t, fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken), auth)

			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte(`{"message": "instance is unreachable"}`)) // could be any other error that is unmapped.
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:             server.URL,
				GMSValidateKeyTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		err := client.ValidateKey(ctx, session)
		require.Error(t, err)
	})
}

func Test_StartSnapshot(t *testing.T) {
	t.Parallel()

	t.Run("when the session is valid, a snapshot result is returned", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		expectedSnapshot := &cloudmigration.StartSnapshotResponse{
			SnapshotID:           "uuid",
			MaxItemsPerPartition: 1024,
			Algo:                 "nacl",
			GMSPublicKey:         []uint8{0x66, 0x6f, 0x6f, 0xa},                               // foo
			Metadata:             []uint8{0x6d, 0x65, 0x74, 0x61, 0x64, 0x61, 0x74, 0x61, 0xa}, // metadata
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)

			auth := r.Header.Get("Authorization")
			require.Equal(t, fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken), auth)

			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"snapshotID": "uuid",
				"maxItemsPerPartition": 1024,
				"algo": "nacl",
				"encryptionKey": "Zm9vCg==",
				"metadata": "bWV0YWRhdGEK"
			}`))
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:               server.URL,
				GMSStartSnapshotTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		resp, err := client.StartSnapshot(ctx, session)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.EqualValues(t, expectedSnapshot, resp)
	})

	t.Run("when there is an error in the upstream, it logs and returns the error", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)

			auth := r.Header.Get("Authorization")
			require.Equal(t, fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken), auth)

			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"message": "internal server error"}`))
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:               server.URL,
				GMSStartSnapshotTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		resp, err := client.StartSnapshot(ctx, session)
		require.Error(t, err)
		require.Nil(t, resp)

		require.Equal(t, 1, logger.ErrorLogs.Calls)
	})
}

func Test_GetSnapshotStatus(t *testing.T) {
	t.Parallel()

	t.Run("it queries the snapshot status and returns it", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		snapshot := cloudmigration.CloudMigrationSnapshot{
			UID: "snapshot-uuid",
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodGet, r.Method)

			auth := r.Header.Get("Authorization")
			require.Equal(t, fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken), auth)

			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"state": "PROCESSING",
				"results": []
			}`))
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:                   server.URL,
				GMSGetSnapshotStatusTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		g, gctx := errgroup.WithContext(ctx)
		for range runtime.NumCPU() * 2 { // run a couple of concurrent requests to check for race condition.
			g.Go(func() error {
				resp, err := client.GetSnapshotStatus(gctx, session, snapshot, 0)
				require.NotNil(t, resp)

				return err
			})
		}
		require.NoError(t, g.Wait())

		require.NotEmpty(t, client.getStatusLastQueried)
	})

	t.Run("when there is an error in the upstream, it logs and returns the error", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		snapshot := cloudmigration.CloudMigrationSnapshot{
			UID: "snapshot-uuid",
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodGet, r.Method)

			auth := r.Header.Get("Authorization")
			require.Equal(t, fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken), auth)

			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"message": "internal server error"}`))
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:                   server.URL,
				GMSGetSnapshotStatusTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		resp, err := client.GetSnapshotStatus(ctx, session, snapshot, 0)
		require.Error(t, err)
		require.Nil(t, resp)

		require.Equal(t, 1, logger.ErrorLogs.Calls)
	})
}

func Test_CreatePresignedUploadUrl(t *testing.T) {
	t.Parallel()

	t.Run("when the snapshot and session are valid, it returns a presigned url string", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		snapshot := cloudmigration.CloudMigrationSnapshot{
			UID: "snapshot-uuid",
		}

		expectedURL := "http://example.com"

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)

			auth := r.Header.Get("Authorization")
			require.Equal(t, fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken), auth)

			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"uploadUrl": "` + expectedURL + `"}`))
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:                 server.URL,
				GMSCreateUploadUrlTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		url, err := client.CreatePresignedUploadUrl(ctx, session, snapshot)
		require.NoError(t, err)
		require.Equal(t, expectedURL, url)
	})

	t.Run("when there is an error in the upstream, it logs and returns the error", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		snapshot := cloudmigration.CloudMigrationSnapshot{
			UID: "snapshot-uuid",
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)

			auth := r.Header.Get("Authorization")
			require.Equal(t, fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken), auth)

			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"message": "internal server error"}`))
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:                 server.URL,
				GMSCreateUploadUrlTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		url, err := client.CreatePresignedUploadUrl(ctx, session, snapshot)
		require.Error(t, err)
		require.Empty(t, url)

		require.Equal(t, 1, logger.ErrorLogs.Calls)
	})
}

func Test_ReportEvent(t *testing.T) {
	t.Parallel()

	t.Run("when the session data is valid, it does not log an error", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		event := EventRequestDTO{
			LocalID: "local-id",
			Event:   EventDoneUploadingSnapshot,
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)

			auth := r.Header.Get("Authorization")
			require.Equal(t, fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken), auth)

			w.WriteHeader(http.StatusNoContent)
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:             server.URL,
				GMSReportEventTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		client.ReportEvent(ctx, session, event)

		require.Zero(t, logger.DebugLogs.Calls)
		require.Zero(t, logger.WarnLogs.Calls)
		require.Zero(t, logger.InfoLogs.Calls)
		require.Zero(t, logger.ErrorLogs.Calls)
	})

	t.Run("when the session is missing required data, it returns without doing anything", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		event := EventRequestDTO{
			Event: EventDoneUploadingSnapshot,
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.True(t, false) // This will never be called, but if it does, it will cause the test to fail.
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:             server.URL,
				GMSReportEventTimeout: 0, // this won't be called.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		client.ReportEvent(ctx, cloudmigration.CloudMigrationSession{}, event)

		require.Zero(t, logger.DebugLogs.Calls)
		require.Zero(t, logger.WarnLogs.Calls)
		require.Zero(t, logger.InfoLogs.Calls)
		require.Zero(t, logger.ErrorLogs.Calls)
	})

	t.Run("when the upstream server is down, it logs the error", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		session := cloudmigration.CloudMigrationSession{
			StackID:     1234,
			AuthToken:   "auth-tok",
			ClusterSlug: "cluster-slug",
		}

		event := EventRequestDTO{
			LocalID: "local-id",
			Event:   EventDoneUploadingSnapshot,
		}

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)

			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"message": "internal server error"}`))
		}))
		t.Cleanup(server.Close)

		cfg := &setting.Cfg{
			CloudMigration: setting.CloudMigrationSettings{
				GMSDomain:             server.URL,
				GMSReportEventTimeout: time.Hour, // arbitrary, it just can't be 0.
			},
		}
		logger := &logtest.Fake{}
		client := gmsClientImpl{cfg: cfg, log: logger, httpClient: http.DefaultClient}

		client.ReportEvent(ctx, session, event)

		require.Zero(t, logger.DebugLogs.Calls)
		require.Zero(t, logger.WarnLogs.Calls)
		require.Zero(t, logger.InfoLogs.Calls)
		require.Equal(t, 2, logger.ErrorLogs.Calls)
	})
}
