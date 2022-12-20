package channels

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/alerting/alerting/notifier/channels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/setting"
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

type emailSender struct {
	ns *notifications.NotificationService
}

func (e emailSender) SendEmail(ctx context.Context, cmd *channels.SendEmailSettings) error {
	attached := make([]*models.SendEmailAttachFile, 0, len(cmd.AttachedFiles))
	for _, file := range cmd.AttachedFiles {
		attached = append(attached, &models.SendEmailAttachFile{
			Name:    file.Name,
			Content: file.Content,
		})
	}
	return e.ns.SendEmailCommandHandlerSync(ctx, &models.SendEmailCommandSync{
		SendEmailCommand: models.SendEmailCommand{
			To:            cmd.To,
			SingleEmail:   cmd.SingleEmail,
			Template:      cmd.Template,
			Subject:       cmd.Subject,
			Data:          cmd.Data,
			Info:          cmd.Info,
			ReplyTo:       cmd.ReplyTo,
			EmbeddedFiles: cmd.EmbeddedFiles,
			AttachedFiles: attached,
		},
	})
}

func createEmailSender(t *testing.T) *emailSender {
	t.Helper()

	tracer := tracing.InitializeTracerForTest()
	bus := bus.ProvideBus(tracer)

	cfg := setting.NewCfg()
	cfg.StaticRootPath = "../../../../../public/"
	cfg.BuildVersion = "4.0.0"
	cfg.Smtp.Enabled = true
	cfg.Smtp.TemplatesPatterns = []string{"emails/*.html", "emails/*.txt"}
	cfg.Smtp.FromAddress = "from@address.com"
	cfg.Smtp.FromName = "Grafana Admin"
	cfg.Smtp.ContentTypes = []string{"text/html", "text/plain"}
	cfg.Smtp.Host = "localhost:1234"
	mailer := notifications.NewFakeMailer()

	ns, err := notifications.ProvideService(bus, cfg, mailer, nil)
	require.NoError(t, err)

	return &emailSender{ns: ns}
}
