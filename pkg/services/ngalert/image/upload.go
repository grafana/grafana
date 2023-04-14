package image

import (
	"context"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/components/imguploader"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type UploadingService struct {
	uploader  imguploader.ImageUploader
	failures  prometheus.Counter
	successes prometheus.Counter
}

func NewUploadingService(uploader imguploader.ImageUploader, r prometheus.Registerer) *UploadingService {
	return &UploadingService{
		uploader: uploader,
		failures: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Name:      "image_upload_failures_total",
			Namespace: "grafana",
			Subsystem: "alerting",
		}),
		successes: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Name:      "image_upload_successes_total",
			Namespace: "grafana",
			Subsystem: "alerting",
		}),
	}
}

// Upload uploads an image and returns a new image with the unmodified path and a URL.
// It returns the unmodified image on error.
func (s *UploadingService) Upload(ctx context.Context, image ngmodels.Image) (ngmodels.Image, error) {
	url, err := s.uploader.Upload(ctx, image.Path)
	if err != nil {
		defer s.failures.Inc()
		return image, fmt.Errorf("failed to upload screenshot: %w", err)
	}
	image.URL = url
	defer s.successes.Inc()
	return image, nil
}
