package store

import (
	"context"
	"errors"
	"mime"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/user"
)

func (s *standardStorageService) sanitizeUploadRequest(ctx context.Context, user *user.SignedInUser, req *UploadRequest, storagePath string) (*filestorage.UpsertFileCommand, error) {
	if req.EntityType == EntityTypeImage {
		ext := filepath.Ext(req.Path)
		if ext == ".svg" && !s.cfg.AllowUnsanitizedSvgUpload {
			grafanaStorageLogger.Debug("Disallowing svg upload", "filename", req.Path)
			return nil, errors.New("SVG uploads are not allowed")
		}
	}

	// we have already validated that the file contents match the extension in `./validate.go`
	mimeType := mime.TypeByExtension(filepath.Ext(req.Path))
	if mimeType == "" {
		grafanaStorageLogger.Info("Failed to find mime type", "path", req.Path)
		mimeType = "application/octet-stream"
	}

	return &filestorage.UpsertFileCommand{
		Path:               storagePath,
		Contents:           req.Contents,
		MimeType:           mimeType,
		CacheControl:       req.CacheControl,
		ContentDisposition: req.ContentDisposition,
		Properties:         req.Properties,
	}, nil
}
