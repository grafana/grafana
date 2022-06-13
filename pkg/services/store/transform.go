package store

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/models"
)

func (s *standardStorageService) transformUploadRequest(ctx context.Context, user *models.SignedInUser, req *UploadRequest, storagePath string) (error, *filestorage.UpsertFileCommand) {
	if req.EntityType == EntityTypeImage {
		ext := filepath.Ext(req.Path)
		if ext == ".svg" {
			// TODO: sanitize svg
		}
	}

	return nil, &filestorage.UpsertFileCommand{
		Path:               storagePath,
		Contents:           req.Contents,
		MimeType:           req.MimeType,
		CacheControl:       req.CacheControl,
		ContentDisposition: req.ContentDisposition,
		Properties:         req.Properties,
	}
}
