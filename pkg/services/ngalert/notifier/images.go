package notifier

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	alertingImages "github.com/grafana/alerting/images"
	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type imageProvider struct {
	store  store.ImageStore
	logger log.Logger
}

func newImageProvider(store store.ImageStore, logger log.Logger) alertingImages.Provider {
	return &imageProvider{
		store:  store,
		logger: logger,
	}
}

func (i imageProvider) GetImage(ctx context.Context, uri string) (*alertingImages.Image, error) {
	image, err := i.getImageFromURI(ctx, uri)
	if err != nil {
		if errors.Is(err, models.ErrImageNotFound) {
			i.logger.Info("Image not found in database")
			return nil, alertingImages.ErrImageNotFound
		}
		return nil, err
	}

	return &alertingImages.Image{
		Token:     image.Token,
		Path:      image.Path,
		URL:       image.URL,
		CreatedAt: image.CreatedAt,
	}, nil
}

func (i imageProvider) GetImageURL(ctx context.Context, alert *alertingNotify.Alert) (string, error) {
	uri, err := getImageURI(alert)
	if err != nil {
		return "", err
	}

	// If the identifier is a URL, validate that it corresponds to a stored, non-expired image.
	if strings.HasPrefix(uri, "http") {
		i.logger.Debug("Received an image URL in annotations", "alert", alert)
		exists, err := i.store.URLExists(ctx, uri)
		if err != nil {
			return "", err
		}
		if !exists {
			i.logger.Info("Image URL not found in database", "alert", alert)
			return "", alertingImages.ErrImageNotFound
		}
		return uri, nil
	}

	// If the identifier is a token, remove the prefix, get the image and return the URL.
	token := strings.TrimPrefix(uri, "token://")
	i.logger.Debug("Received an image token in annotations", "alert", alert, "token", token)
	return i.getImageURLFromToken(ctx, token)
}

// getImageURLFromToken takes a token and returns the URL of the image that token belongs to.
func (i imageProvider) getImageURLFromToken(ctx context.Context, token string) (string, error) {
	image, err := i.store.GetImage(ctx, token)
	if err != nil {
		if errors.Is(err, models.ErrImageNotFound) {
			i.logger.Info("Image not found in database", "token", token)
			return "", alertingImages.ErrImageNotFound
		}
		return "", err
	}

	if !image.HasURL() {
		return "", alertingImages.ErrImagesNoURL
	}
	return image.URL, nil
}

func (i imageProvider) GetRawImage(ctx context.Context, alert *alertingNotify.Alert) (io.ReadCloser, string, error) {
	uri, err := getImageURI(alert)
	if err != nil {
		return nil, "", err
	}

	image, err := i.getImageFromURI(ctx, uri)
	if err != nil {
		if errors.Is(err, models.ErrImageNotFound) {
			i.logger.Info("Image not found in database", "alert", alert)
			return nil, "", alertingImages.ErrImageNotFound
		}
		return nil, "", err
	}
	if !image.HasPath() {
		return nil, "", alertingImages.ErrImagesNoPath
	}

	// Return image bytes and filename.
	readCloser, err := openImage(image.Path)
	if err != nil {
		i.logger.Error("Error looking for image on disk", "alert", alert, "path", image.Path, "error", err)
		return nil, "", err
	}
	filename := filepath.Base(image.Path)
	return readCloser, filename, nil
}

func (i imageProvider) getImageFromURI(ctx context.Context, uri string) (*models.Image, error) {
	// Check whether the uri is a URL or a token to know how to query the DB.
	if strings.HasPrefix(uri, "http") {
		i.logger.Debug("Received an image URL in annotations")
		return i.store.GetImageByURL(ctx, uri)
	}

	token := strings.TrimPrefix(uri, "token://")
	i.logger.Debug("Received an image token in annotations", "token", token)
	return i.store.GetImage(ctx, token)
}

// getImageURI is a helper function to retrieve the image URI from the alert annotations as a string.
func getImageURI(alert *alertingNotify.Alert) (string, error) {
	uri, ok := alert.Annotations[alertingModels.ImageTokenAnnotation]
	if !ok {
		return "", alertingImages.ErrNoImageForAlert
	}
	return string(uri), nil
}

// openImage returns an the io representation of an image from the given path.
func openImage(path string) (io.ReadCloser, error) {
	fp := filepath.Clean(path)
	_, err := os.Stat(fp)
	if os.IsNotExist(err) || os.IsPermission(err) {
		return nil, alertingImages.ErrImageNotFound
	}

	f, err := os.Open(fp)
	if err != nil {
		return nil, err
	}

	return f, nil
}
