package dashboardimage

import "context"

type Service interface {
	TakeScreenshotAndUpload(ctx context.Context, opts ScreenshotOptions) (string, error)
}
