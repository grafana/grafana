package store

import (
	"context"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/store/sanitizer"
)

func (s *standardStorageService) sanitizeContents(ctx context.Context, user *models.SignedInUser, req *UploadRequest, storagePath string) ([]byte, error) {
	if req.EntityType == EntityTypeImage {
		ext := filepath.Ext(req.Path)
		if ext == ".svg" {
			resp, err := sanitizer.SanitizeSVG(ctx, &rendering.SanitizeSVGRequest{
				Filename: storagePath,
				Content:  req.Contents,
			})
			if err != nil {
				if s.cfg.allowUnsanitizedSvgUpload {
					grafanaStorageLogger.Debug("allowing unsanitized svg upload", "filename", req.Path, "sanitizationError", err)
					return req.Contents, nil
				} else {
					grafanaStorageLogger.Debug("disallowing unsanitized svg upload", "filename", req.Path, "sanitizationError", err)
					return nil, err
				}
			}

			return resp.Sanitized, nil
		}
	}

	return req.Contents, nil
}

func (s *standardStorageService) sanitizeUploadRequest(ctx context.Context, user *models.SignedInUser, req *UploadRequest, storagePath string) (*filestorage.UpsertFileCommand, error) {
	contents, err := s.sanitizeContents(ctx, user, req, storagePath)
	if err != nil {
		return nil, err
	}

	return &filestorage.UpsertFileCommand{
		Path:               storagePath,
		Contents:           contents,
		MimeType:           req.MimeType,
		CacheControl:       req.CacheControl,
		ContentDisposition: req.ContentDisposition,
		Properties:         req.Properties,
	}, nil
}
