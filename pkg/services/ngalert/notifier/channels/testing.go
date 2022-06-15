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
type deleteFunc func()

// newFakeImageStore creates a fake image on disk and returns an image
// with a token, path and URL. The test should call deleteFunc to delete
// the image from disk at the end of the test.
func newFakeImageStore(t *testing.T) (ImageStore, deleteFunc) {
	f, err := os.CreateTemp("", "ngalert-test-image-*.png")
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

type fakeImageStore struct {
	Images []*ngmodels.Image
}

func (f *fakeImageStore) GetImage(ctx context.Context, token string) (*ngmodels.Image, error) {
	for _, img := range f.Images {
		if img.Token == token {
			return img, nil
		}
	}
	return nil, ngmodels.ErrImageNotFound
}
