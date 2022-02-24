package channels

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

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
