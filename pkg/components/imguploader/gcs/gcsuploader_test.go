package gcs

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"cloud.google.com/go/storage"
	"github.com/golang/mock/gomock"
	"github.com/grafana/grafana/pkg/ifaces/gcsifaces"
	"github.com/grafana/grafana/pkg/mocks/mock_gcsifaces"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2/google"
	"golang.org/x/oauth2/jwt"
	"google.golang.org/api/option"
)

const dfltExpiration = 7 * 24 * time.Hour

type testConfig struct {
	signedURL string
}

func mockSDK(ctx context.Context, t *testing.T, content []byte, bucket string, signed bool) testConfig {
	t.Helper()

	var cfg testConfig

	ctrl := gomock.NewController(t)
	t.Cleanup(func() {
		ctrl.Finish()
	})

	wm := mock_gcsifaces.NewMockStorageWriter(ctrl)
	if !signed {
		wm.
			EXPECT().
			SetACL(gomock.Eq("publicRead")).
			Return()
	}
	wm.EXPECT().
		Write(gomock.Eq(content)).
		Return(len(content), nil)
	wm.EXPECT().
		Close()

	om := mock_gcsifaces.NewMockStorageObject(ctrl)
	om.
		EXPECT().
		NewWriter(gomock.Eq(ctx)).
		Return(wm)

	bm := mock_gcsifaces.NewMockStorageBucket(ctrl)
	bm.
		EXPECT().
		Object(gomock.Any()).
		Return(om)

	cm := mock_gcsifaces.NewMockStorageClient(ctrl)
	cm.
		EXPECT().
		Bucket(gomock.Eq(bucket)).
		Return(bm)

	if signed {
		const scope = storage.ScopeReadWrite
		cfg.signedURL = "https://google.com/signed"

		creds := &google.Credentials{
			JSON: []byte(`{}`),
		}
		conf := &jwt.Config{
			Email:      "test@grafana.com",
			PrivateKey: []byte("private"),
		}
		suOpts := &storage.SignedURLOptions{
			Scheme:         storage.SigningSchemeV4,
			Method:         "GET",
			GoogleAccessID: conf.Email,
			PrivateKey:     conf.PrivateKey,
			Expires:        time.Now().Add(dfltExpiration),
		}
		cm.
			EXPECT().
			FindDefaultCredentials(gomock.Eq(ctx), gomock.Eq(scope)).
			Return(creds, nil)
		cm.
			EXPECT().
			JWTConfigFromJSON(gomock.Eq(creds.JSON)).
			Return(conf, nil)
		cm.
			EXPECT().
			SignedURL(gomock.Eq(bucket), gomock.Any(), signedURLOptsMatcher{suOpts}).
			Return(cfg.signedURL, nil)
	}

	origNewClient := newClient
	t.Cleanup(func() {
		newClient = origNewClient
	})
	newClient = func(ctx context.Context, options ...option.ClientOption) (gcsifaces.StorageClient, error) {
		return cm, nil
	}

	return cfg
}

func TestUploadToGCS_DefaultCredentials(t *testing.T) {
	const bucket = "test"
	content := []byte("test\n")
	tmpDir := t.TempDir()
	fpath := filepath.Join(tmpDir, "test.png")
	err := os.WriteFile(fpath, content, 0600)
	require.NoError(t, err)

	t.Run("Without signed URL", func(t *testing.T) {
		ctx := context.Background()
		mockSDK(ctx, t, content, bucket, false)

		uploader, err := NewUploader("", bucket, "", false, dfltExpiration)
		require.NoError(t, err)

		path, err := uploader.Upload(ctx, fpath)
		require.NoError(t, err)

		assert.Regexp(t, fmt.Sprintf(`^https://storage.googleapis.com/%s/[^/]+\.png$`, bucket), path)
	})

	t.Run("With signed URL", func(t *testing.T) {
		ctx := context.Background()
		cfg := mockSDK(ctx, t, content, bucket, true)

		uploader, err := NewUploader("", bucket, "", true, dfltExpiration)
		require.NoError(t, err)

		path, err := uploader.Upload(ctx, fpath)
		require.NoError(t, err)

		assert.Equal(t, cfg.signedURL, path)
	})
}

type signedURLOptsMatcher struct {
	opts *storage.SignedURLOptions
}

func (m signedURLOptsMatcher) Matches(x interface{}) bool {
	suOpts, ok := x.(*storage.SignedURLOptions)
	if !ok {
		return false
	}

	return suOpts.Scheme == m.opts.Scheme && suOpts.Method == m.opts.Method && suOpts.GoogleAccessID ==
		m.opts.GoogleAccessID && bytes.Equal(suOpts.PrivateKey, m.opts.PrivateKey)
}

func (m signedURLOptsMatcher) String() string {
	return "Matches two SignedURLOptions"
}
