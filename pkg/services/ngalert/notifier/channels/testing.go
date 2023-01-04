package channels

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/alerting/alerting/notifier/channels"
)

type fakeImageStore struct {
	Images []*channels.Image
}

// getImage returns an image with the same token.
func (f *fakeImageStore) GetImage(_ context.Context, token string) (*channels.Image, error) {
	for _, img := range f.Images {
		if img.Token == token {
			return img, nil
		}
	}
	return nil, channels.ErrImageNotFound
}

// newFakeImageStore returns an image store with N test images.
// Each image has a token and a URL, but does not have a file on disk.
func newFakeImageStore(n int) channels.ImageStore {
	s := fakeImageStore{}
	for i := 1; i <= n; i++ {
		s.Images = append(s.Images, &channels.Image{
			Token:     fmt.Sprintf("test-image-%d", i),
			URL:       fmt.Sprintf("https://www.example.com/test-image-%d.jpg", i),
			CreatedAt: time.Now().UTC(),
		})
	}
	return &s
}

// mockTimeNow replaces function timeNow to return constant time.
// It returns a function that resets the variable back to its original value.
// This allows usage of this function with defer:
//
//	func Test (t *testing.T) {
//	   now := time.Now()
//	   defer mockTimeNow(now)()
//	   ...
//	}
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
	Webhook     channels.SendWebhookSettings
	EmailSync   channels.SendEmailSettings
	ShouldError error
}

func (ns *notificationServiceMock) SendWebhook(ctx context.Context, cmd *channels.SendWebhookSettings) error {
	ns.Webhook = *cmd
	return ns.ShouldError
}
func (ns *notificationServiceMock) SendEmail(ctx context.Context, cmd *channels.SendEmailSettings) error {
	ns.EmailSync = *cmd
	return ns.ShouldError
}

func mockNotificationService() *notificationServiceMock { return &notificationServiceMock{} }
