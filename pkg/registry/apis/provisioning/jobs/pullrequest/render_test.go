package pullrequest

import (
	"context"
	"errors"
	"net/url"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

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
	t.Run("should fail when path contains protocol", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		blobstore := NewMockBlobStoreClient(t)

		renderer := NewScreenshotRenderer(render, blobstore)
		_, err := renderer.RenderScreenshot(context.Background(), provisioning.ResourceRepositoryInfo{}, "http://test", nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "path should be relative")
	})

	t.Run("should fail when path starts with slash", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		blobstore := NewMockBlobStoreClient(t)

		renderer := NewScreenshotRenderer(render, blobstore)
		_, err := renderer.RenderScreenshot(context.Background(), provisioning.ResourceRepositoryInfo{}, "/test", nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "path should not start with slash")
	})

	t.Run("should fail when render service fails", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
			DoAndReturn(func(_ context.Context, _ rendering.RenderType, opts rendering.Opts, _ rendering.AuthOpts) (*rendering.RenderResult, error) {
				require.Equal(t, "test?kiosk", opts.Path)
				require.Equal(t, 1, opts.OrgID)
				require.Equal(t, 1, opts.UserID)
				require.Equal(t, 1024, opts.Width)
				require.Equal(t, -1, opts.Height)
				require.Equal(t, models.ThemeDark, opts.Theme)
				return nil, errors.New("render error")
			})

		blobstore := NewMockBlobStoreClient(t)

		renderer := NewScreenshotRenderer(render, blobstore)
		_, err := renderer.RenderScreenshot(context.Background(), provisioning.ResourceRepositoryInfo{}, "test", nil)
		require.Error(t, err)
		require.EqualError(t, err, "render error")
	})

	t.Run("should fail when blobstore fails", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
			Return(&rendering.RenderResult{
				FilePath: "test.png",
			}, nil)

		blobstore := NewMockBlobStoreClient(t)
		blobstore.On("PutBlob", mock.Anything, mock.MatchedBy(func(req *resource.PutBlobRequest) bool {
			return req.Resource.Group == provisioning.GROUP &&
				req.Resource.Resource == provisioning.RepositoryResourceInfo.GroupResource().Resource &&
				req.Method == resource.PutBlobRequest_GRPC &&
				req.ContentType == "image/png"
		})).Return(nil, errors.New("blobstore error"))

		renderer := NewScreenshotRenderer(render, blobstore)
		_, err := renderer.RenderScreenshot(context.Background(), provisioning.ResourceRepositoryInfo{}, "test", nil)
		require.Error(t, err)
		require.EqualError(t, err, "blobstore error")

		blobstore.AssertExpectations(t)
	})

	t.Run("should return URL when blobstore provides one", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
			Return(&rendering.RenderResult{
				FilePath: "test.png",
			}, nil)

		blobstore := NewMockBlobStoreClient(t)
		blobstore.On("PutBlob", mock.Anything, mock.Anything).
			Return(&resource.PutBlobResponse{
				Url: "https://example.com/test.png",
			}, nil)

		renderer := NewScreenshotRenderer(render, blobstore)
		url, err := renderer.RenderScreenshot(context.Background(), provisioning.ResourceRepositoryInfo{
			Name:      "test-repo",
			Namespace: "test-ns",
		}, "test", nil)
		require.NoError(t, err)
		require.Equal(t, "https://example.com/test.png", url)

		blobstore.AssertExpectations(t)
	})

	t.Run("should return API path when blobstore provides UID", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
			Return(&rendering.RenderResult{
				FilePath: "test.png",
			}, nil)

		blobstore := NewMockBlobStoreClient(t)
		blobstore.On("PutBlob", mock.Anything, mock.Anything).
			Return(&resource.PutBlobResponse{
				Uid: "test-uid",
			}, nil)

		renderer := NewScreenshotRenderer(render, blobstore)
		url, err := renderer.RenderScreenshot(context.Background(), provisioning.ResourceRepositoryInfo{
			Name:      "test-repo",
			Namespace: "test-ns",
		}, "test", nil)
		require.NoError(t, err)
		require.Equal(t, "apis/provisioning.grafana.app/v0alpha1/namespaces/test-ns/repositories/test-repo/render/test-uid", url)

		blobstore.AssertExpectations(t)
	})

	t.Run("should append query parameters correctly", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		render := rendering.NewMockService(ctrl)
		render.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any(), gomock.Any()).
			DoAndReturn(func(_ context.Context, _ rendering.RenderType, opts rendering.Opts, _ rendering.AuthOpts) (*rendering.RenderResult, error) {
				require.Equal(t, "test?param1=value1&param2=value2&kiosk", opts.Path)
				return &rendering.RenderResult{
					FilePath: "test.png",
				}, nil
			})

		blobstore := NewMockBlobStoreClient(t)
		blobstore.On("PutBlob", mock.Anything, mock.Anything).
			Return(&resource.PutBlobResponse{
				Uid: "test-uid",
			}, nil)

		renderer := NewScreenshotRenderer(render, blobstore)
		values := url.Values{}
		values.Add("param1", "value1")
		values.Add("param2", "value2")
		_, err := renderer.RenderScreenshot(context.Background(), provisioning.ResourceRepositoryInfo{}, "test", values)
		require.NoError(t, err)

		blobstore.AssertExpectations(t)
	})
}
