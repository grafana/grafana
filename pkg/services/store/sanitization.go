package store

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/models"
)

func (s *standardStorageService) sanitizeUploadRequest(ctx context.Context, user *models.SignedInUser, req *UploadRequest) error {
	if req.EntityType == EntityTypeImage {
		ext := filepath.Ext(req.Path)
		if ext == ".svg" {
			// TODO: sanitize svg
		}
	}

	return nil
}
