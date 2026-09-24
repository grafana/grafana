package state

import "github.com/grafana/grafana/pkg/services/ngalert/models"

type ImageAttempt struct {
	models.Image
	Error error
}

func newImageAttempt(img *models.Image, err error) *ImageAttempt {
	if img == nil && err == nil {
		return nil
	}
	if err != nil {
		return &ImageAttempt{Error: err}
	}
	return &ImageAttempt{Image: *img}
}
