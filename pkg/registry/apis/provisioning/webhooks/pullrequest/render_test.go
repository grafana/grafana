package pullrequest

import (
	"context"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func setupTempFile(t *testing.T) (string, func()) {
	t.Helper()

	// Create a temporary directory
	tmpDir, err := os.MkdirTemp("", "screenshot-renderer-test-*")
	require.NoError(t, err)

	// Create a temporary file
	tmpFile := filepath.Join(tmpDir, "test.png")
	err = os.WriteFile(tmpFile, []byte("test"), 0644)
	require.NoError(t, err)

	// Return cleanup function
	cleanup := func() {
		err := os.RemoveAll(tmpDir)
		require.NoError(t, err)
	}

	return tmpFile, cleanup
}

func TestScreenshotRenderer_IsAvailable(t *testing.T) {
	t.Run("should return false when render service is nil", func(t *testing.T) {
		blobstore := NewMockBlobStoreClient(t)
		renderer := NewScreenshotRenderer(nil, blobstore)
		require.False(t, renderer.IsAvailable(context.Background()))
	})

	t.Run("should return false when render service is not available", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		render.EXPECT().IsAvailable(gomock.Any()).Return(false)
		blobstore := NewMockBlobStoreClient(t)

		renderer := NewScreenshotRenderer(render, blobstore)
		require.False(t, renderer.IsAvailable(context.Background()))
	})

	t.Run("should return false when blobstore is nil", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		render.EXPECT().IsAvailable(gomock.Any()).Return(true)

		renderer := NewScreenshotRenderer(render, nil)
		require.False(t, renderer.IsAvailable(context.Background()))
	})

	t.Run("should return true when both services are available", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		render.EXPECT().IsAvailable(gomock.Any()).Return(true)
		blobstore := NewMockBlobStoreClient(t)

		renderer := NewScreenshotRenderer(render, blobstore)
		require.True(t, renderer.IsAvailable(context.Background()))
	})
}

func TestScreenshotRenderer_RenderScreenshot(t *testing.T) {
	type testCase struct {
		name           string
		path           string
		queryParams    url.Values
		repoInfo       provisioning.ResourceRepositoryInfo
		setupRender    func(ctrl *gomock.Controller) rendering.Service
		setupBlobstore func(t *testing.T) BlobStoreClient
		expectedURL    string
		expectedError  string
	}

	tests := []testCase{
		{
			name: "should fail when path contains protocol",
			path: "http://test",
			setupRender: func(ctrl *gomock.Controller) rendering.Service {
				return rendering.NewMockService(ctrl)
			},
			setupBlobstore: func(t *testing.T) BlobStoreClient {
				return NewMockBlobStoreClient(t)
			},
			expectedError: "path should be relative",
		},
		{
			name: "should fail when path starts with slash",
			path: "/test",
			setupRender: func(ctrl *gomock.Controller) rendering.Service {
				return rendering.NewMockService(ctrl)
			},
			setupBlobstore: func(t *testing.T) BlobStoreClient {
				return NewMockBlobStoreClient(t)
			},
			expectedError: "path should not start with slash",
		},
		{
			name: "should fail when render service fails",
			path: "test",
			setupRender: func(ctrl *gomock.Controller) rendering.Service {
				render := rendering.NewMockService(ctrl)
				render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
					DoAndReturn(func(_ context.Context, _ rendering.RenderType, opts rendering.Opts, _ rendering.AuthOpts) (*rendering.RenderResult, error) {
						require.Equal(t, "test?kiosk", opts.Path)
						require.Equal(t, int64(1), opts.OrgID)
						require.Equal(t, int64(1), opts.UserID)
						require.Equal(t, 1024, opts.Width)
						require.Equal(t, -1, opts.Height)
						require.Equal(t, models.ThemeDark, opts.Theme)
						return nil, errors.New("render error")
					})
				return render
			},
			setupBlobstore: func(t *testing.T) BlobStoreClient {
				return NewMockBlobStoreClient(t)
			},
			expectedError: "render error",
		},
		{
			name: "should fail when the rendered file does not exist",
			path: "test",
			setupRender: func(ctrl *gomock.Controller) rendering.Service {
				render := rendering.NewMockService(ctrl)
				render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
					Return(&rendering.RenderResult{
						FilePath: "/non/existent/file.png",
					}, nil)
				return render
			},
			setupBlobstore: func(t *testing.T) BlobStoreClient {
				return NewMockBlobStoreClient(t)
			},
			expectedError: "no such file or directory",
		},
		{
			name: "should fail when blobstore fails",
			path: "test",
			setupRender: func(ctrl *gomock.Controller) rendering.Service {
				tmpFile, cleanup := setupTempFile(t)
				t.Cleanup(cleanup)
				render := rendering.NewMockService(ctrl)
				render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
					Return(&rendering.RenderResult{
						FilePath: tmpFile,
					}, nil)
				return render
			},
			setupBlobstore: func(t *testing.T) BlobStoreClient {
				blobstore := NewMockBlobStoreClient(t)
				blobstore.On("PutBlob", mock.Anything, mock.MatchedBy(func(req *resource.PutBlobRequest) bool {
					return req.Resource.Group == provisioning.GROUP &&
						req.Resource.Resource == provisioning.RepositoryResourceInfo.GroupResource().Resource &&
						req.Method == resource.PutBlobRequest_GRPC &&
						req.ContentType == "image/png"
				})).Return(nil, errors.New("blobstore error"))
				return blobstore
			},
			expectedError: "blobstore error",
		},
		{
			name: "should return URL when blobstore provides one",
			path: "test",
			repoInfo: provisioning.ResourceRepositoryInfo{
				Name:      "test-repo",
				Namespace: "test-ns",
			},
			setupRender: func(ctrl *gomock.Controller) rendering.Service {
				tmpFile, cleanup := setupTempFile(t)
				t.Cleanup(cleanup)
				render := rendering.NewMockService(ctrl)
				render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
					Return(&rendering.RenderResult{
						FilePath: tmpFile,
					}, nil)
				return render
			},
			setupBlobstore: func(t *testing.T) BlobStoreClient {
				blobstore := NewMockBlobStoreClient(t)
				blobstore.On("PutBlob", mock.Anything, mock.Anything).
					Return(&resource.PutBlobResponse{
						Url: "https://example.com/test.png",
					}, nil)
				return blobstore
			},
			expectedURL: "https://example.com/test.png",
		},
		{
			name: "should return API path when blobstore provides UID",
			path: "test",
			repoInfo: provisioning.ResourceRepositoryInfo{
				Name:      "test-repo",
				Namespace: "test-ns",
			},
			setupRender: func(ctrl *gomock.Controller) rendering.Service {
				tmpFile, cleanup := setupTempFile(t)
				t.Cleanup(cleanup)
				render := rendering.NewMockService(ctrl)
				render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
					Return(&rendering.RenderResult{
						FilePath: tmpFile,
					}, nil)
				return render
			},
			setupBlobstore: func(t *testing.T) BlobStoreClient {
				blobstore := NewMockBlobStoreClient(t)
				blobstore.On("PutBlob", mock.Anything, mock.Anything).
					Return(&resource.PutBlobResponse{
						Uid: "test-uid",
					}, nil)
				return blobstore
			},
			expectedURL: "apis/provisioning.grafana.app/v0alpha1/namespaces/test-ns/repositories/test-repo/render/test-uid",
		},
		{
			name: "should append query parameters correctly",
			path: "test",
			queryParams: url.Values{
				"param1": []string{"value1"},
				"param2": []string{"value2"},
			},
			setupRender: func(ctrl *gomock.Controller) rendering.Service {
				tmpFile, cleanup := setupTempFile(t)
				t.Cleanup(cleanup)
				render := rendering.NewMockService(ctrl)
				render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
					DoAndReturn(func(_ context.Context, _ rendering.RenderType, opts rendering.Opts, _ rendering.AuthOpts) (*rendering.RenderResult, error) {
						require.Equal(t, "test?param1=value1&param2=value2&kiosk", opts.Path)
						return &rendering.RenderResult{
							FilePath: tmpFile,
						}, nil
					})
				return render
			},
			setupBlobstore: func(t *testing.T) BlobStoreClient {
				blobstore := NewMockBlobStoreClient(t)
				blobstore.On("PutBlob", mock.Anything, mock.Anything).
					Return(&resource.PutBlobResponse{
						Uid: "test-uid",
					}, nil)
				return blobstore
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			render := tc.setupRender(ctrl)
			blobstore := tc.setupBlobstore(t)

			renderer := NewScreenshotRenderer(render, blobstore)
			url, err := renderer.RenderScreenshot(context.Background(), tc.repoInfo, tc.path, tc.queryParams)

			if tc.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tc.expectedError)
			} else {
				require.NoError(t, err)
				if tc.expectedURL != "" {
					require.Equal(t, tc.expectedURL, url)
				}
			}

			if mock, ok := blobstore.(*MockBlobStoreClient); ok {
				mock.AssertExpectations(t)
			}
		})
	}
}
