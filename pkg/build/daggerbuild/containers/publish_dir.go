package containers

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strings"

	"dagger.io/dagger"
)

func publishLocalDir(ctx context.Context, dir *dagger.Directory, dst string) error {
	if _, err := dir.Export(ctx, dst); err != nil {
		return err
	}

	return nil
}

func publishGCSDir(ctx context.Context, d *dagger.Client, dir *dagger.Directory, opts *GCPOpts, dst string) error {
	auth := GCSAuth(d, opts)
	uploader, err := GCSUploadDirectory(d, GoogleCloudImage, auth, dir, dst)
	if err != nil {
		return err
	}

	if _, err := ExitError(ctx, uploader); err != nil {
		return err
	}

	return nil
}

// PublishDirectory publishes a directory to the given destination.
func PublishDirectory(ctx context.Context, d *dagger.Client, dir *dagger.Directory, opts *GCPOpts, dst string) (string, error) {
	log.Println("Publishing directory", dst)
	u, err := url.Parse(dst)
	if err != nil {
		// If the destination URL is not a URL then we can assume that it's just a filepath.
		if err := publishLocalDir(ctx, dir, dst); err != nil {
			return "", err
		}
		return "", err
	}

	switch u.Scheme {
	case "file", "fs":
		dst := strings.TrimPrefix(u.String(), u.Scheme+"://")
		if err := publishLocalDir(ctx, dir, dst); err != nil {
			return "", err
		}
	case "gs":
		if err := publishGCSDir(ctx, d, dir, opts, dst); err != nil {
			return "", err
		}
	default:
		return "", fmt.Errorf("%w: '%s'", ErrorUnrecognizedScheme, u.Scheme)
	}

	return dst, nil
}
