package store

import (
	"errors"
)

func UploadErrorToStatusCode(err error) int {
	switch {
	case errors.Is(err, ErrStorageNotFound):
		return 404

	case errors.Is(err, ErrUnsupportedStorage):
		return 400

	case errors.Is(err, ErrValidationFailed):
		return 400

	case errors.Is(err, ErrQuotaReached):
		return 400

	case errors.Is(err, ErrFileAlreadyExists):
		return 400

	case errors.Is(err, ErrAccessDenied):
		return 403

	default:
		return 500
	}
}
