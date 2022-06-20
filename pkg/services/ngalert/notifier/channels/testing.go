package channels

import (
	"context"
	"encoding/base64"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// deleteFunc deletes the fake image.
// nolint:unused
type deleteFunc func()

type fakeImageStore struct {
	Images []*ngmodels.Image
}

// getImage returns an image with the same token.
func (f *fakeImageStore) GetImage(_ context.Context, token string) (*ngmodels.Image, error) {
	for _, img := range f.Images {
		if img.Token == token {
			return img, nil
		}
	}
	return nil, ngmodels.ErrImageNotFound
}

// newFakeImageStore returns an image store with a test image.
// The image has a token and a URL, but does not have a file on disk.
func newFakeImageStore() ImageStore {
	return &fakeImageStore{
		Images: []*ngmodels.Image{
			{
				Token:     "test-image",
				URL:       "https://www.example.com/test-image.jpg",
				CreatedAt: time.Now().UTC(),
			},
		},
	}
}

// newFakeImageStoreWithFile returns an image store with a test image.
// The image has a token, path and a URL, where the path is 1x1 transparent
// PNG on disk. The test should call deleteFunc to delete the image from disk
// at the end of the test.
// nolint:deadcode,unused
func newFakeImageStoreWithFile(t *testing.T) (ImageStore, deleteFunc) {
	f, err := os.CreateTemp("", "test-image-*.png")
	if err != nil {
		t.Fatalf("failed to create temp image: %s", err)
	}

	// 1x1 transparent PNG
	b, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
	if err != nil {
		t.Fatalf("failed to decode PNG data: %s", err)
	}

	if _, err := f.Write(b); err != nil {
		t.Fatalf("failed to write to file: %s", err)
	}

	if err := f.Close(); err != nil {
		t.Fatalf("failed to close file: %s", err)
	}

	fn := func() {
		if err := os.Remove(f.Name()); err != nil {
			t.Fatalf("failed to delete file: %s", err)
		}
	}

	store := &fakeImageStore{
		Images: []*ngmodels.Image{
			{
				Token:     "test-image",
				Path:      f.Name(),
				URL:       "https://www.example.com/test-image.jpg",
				CreatedAt: time.Now().UTC(),
			},
		},
	}

	return store, fn
}

// mockTimeNow replaces function timeNow to return constant time.
// It returns a function that resets the variable back to its original value.
// This allows usage of this function with defer:
// func Test (t *testing.T) {
//    now := time.Now()
//    defer mockTimeNow(now)()
//    ...
// }
func mockTimeNow(constTime time.Time) func() {
	timeNow = func() time.Time {
		return constTime
	}
	return resetTimeNow
}

// resetTimeNow resets the global variable timeNow to the default value, which is time.Now
func resetTimeNow() {
	timeNow = time.Now
}

type notificationServiceMock struct {
	Webhook     models.SendWebhookSync
	EmailSync   models.SendEmailCommandSync
	Emailx      models.SendEmailCommand
	ShouldError error
}

func (ns *notificationServiceMock) SendWebhookSync(ctx context.Context, cmd *models.SendWebhookSync) error {
	ns.Webhook = *cmd
	return ns.ShouldError
}
func (ns *notificationServiceMock) SendEmailCommandHandlerSync(ctx context.Context, cmd *models.SendEmailCommandSync) error {
	ns.EmailSync = *cmd
	return ns.ShouldError
}
func (ns *notificationServiceMock) SendEmailCommandHandler(ctx context.Context, cmd *models.SendEmailCommand) error {
	ns.Emailx = *cmd
	return ns.ShouldError
}

func mockNotificationService() *notificationServiceMock { return &notificationServiceMock{} }
