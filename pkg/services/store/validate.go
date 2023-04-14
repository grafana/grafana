package store

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/store/kind/svg"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	allowedImageExtensions = map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".svg":  true,
		".gif":  true,
		".png":  true,
		".webp": true,
	}
	imageExtensionsToMatchingMimeTypes = map[string]map[string]bool{
		".jpg":  {"image/jpg": true, "image/jpeg": true},
		".jpeg": {"image/jpg": true, "image/jpeg": true},
		".gif":  {"image/gif": true},
		".png":  {"image/png": true},
		".webp": {"image/webp": true},
		".svg":  {"image/svg+xml": true},
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

func (s *standardStorageService) detectMimeType(ctx context.Context, user *user.SignedInUser, uploadRequest *UploadRequest) string {
	if strings.HasSuffix(uploadRequest.Path, ".svg") {
		if svg.IsSVG(uploadRequest.Contents) {
			return "image/svg+xml"
		}
	}

	return http.DetectContentType(uploadRequest.Contents)
}

func (s *standardStorageService) validateImage(ctx context.Context, user *user.SignedInUser, uploadRequest *UploadRequest) validationResult {
	ext := filepath.Ext(uploadRequest.Path)
	if !allowedImageExtensions[ext] {
		return fail(fmt.Sprintf("unsupported extension: %s", ext))
	}

	mimeType := s.detectMimeType(ctx, user, uploadRequest)
	if !imageExtensionsToMatchingMimeTypes[ext][mimeType] {
		return fail(fmt.Sprintf("extension '%s' does not match the detected MimeType: %s", ext, mimeType))
	}

	return success()
}

func (s *standardStorageService) validateUploadRequest(ctx context.Context, user *user.SignedInUser, req *UploadRequest, storagePath string) validationResult {
	// TODO: validateSize
	// TODO: validateProperties

	if err := filestorage.ValidatePath(storagePath); err != nil {
		return fail(fmt.Sprintf("path validation failed. error: %s. path: %s", err.Error(), storagePath))
	}

	switch req.EntityType {
	case EntityTypeJSON:
		fallthrough
	case EntityTypeFolder:
		fallthrough
	case EntityTypeDashboard:
		// TODO: add proper validation
		if !json.Valid(req.Contents) {
			return fail("invalid json")
		}
		return success()
	case EntityTypeImage:
		return s.validateImage(ctx, user, req)
	default:
		return fail("unknown entity")
	}
}
