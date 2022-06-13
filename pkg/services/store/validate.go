package store

import (
	"context"
	"encoding/json"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/models"
)

var (
	allowedImageExtensions = map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".gif":  true,
		".png":  true,
		".webp": true,
	}
	imageExtensionsToMatchingMimeType = map[string]string{
		".jpg":  "image/jpg",
		".jpeg": "image/jpg",
		".gif":  "image/gif",
		".png":  "image/png",
		".webp": "image/webp",
	}
)

type validationResult struct {
	ok     bool
	reason string
}

func success() validationResult {
	return validationResult{
		ok: true,
	}
}

func fail(reason string) validationResult {
	return validationResult{
		ok:     false,
		reason: reason,
	}
}

func (s *standardStorageService) detectMimeType(ctx context.Context, user *models.SignedInUser, uploadRequest *UploadRequest) string {
	// TODO: implement a spoofing-proof MimeType detection based on the contents
	return uploadRequest.MimeType
}

func (s *standardStorageService) validateImage(ctx context.Context, user *models.SignedInUser, uploadRequest *UploadRequest) validationResult {
	ext := filepath.Ext(uploadRequest.Path)
	if !allowedImageExtensions[ext] {
		return fail("unsupported extension")
	}

	mimeType := s.detectMimeType(ctx, user, uploadRequest)
	if imageExtensionsToMatchingMimeType[ext] != mimeType {
		return fail("mismatched extension and file contents")
	}

	return success()
}

func (s *standardStorageService) validateUploadRequest(ctx context.Context, user *models.SignedInUser, req *UploadRequest, storagePath string) validationResult {
	// TODO: validateSize
	// TODO: validateProperties

	if err := filestorage.ValidatePath(storagePath); err != nil {
		grafanaStorageLogger.Info("uploading file failed due to invalid path", "filetype", req.MimeType, "path", req.Path, "err", err)
		return fail("path validation failed: " + err.Error())
	}

	switch req.EntityType {
	case EntityTypeFolder:
		fallthrough
	case EntityTypeDashboard:
		// TODO: add proper validation
		var something interface{}
		if err := json.Unmarshal(req.Contents, &something); err != nil {
			return fail(err.Error())
		}

		return success()
	case EntityTypeImage:
		return s.validateImage(ctx, user, req)
	default:
		return fail("unknown entity")
	}
}
