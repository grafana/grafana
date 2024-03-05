package slack

import (
	"context"
	"github.com/grafana/grafana/pkg/api/dtos"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/slack/model"
)

type Service interface {
	GetUserConversations(ctx context.Context) (*dtos.SlackChannels, error)
	PostMessage(ctx context.Context, shareRequest dtos.ShareRequest, dashboardLink string) error
	PostUnfurl(ctx context.Context, linkEvent model.EventPayload, imageURL string, dashboardTitle string) error
	ValidateSignatureRequest(c *contextmodel.ReqContext, body string) bool
	TakeScreenshot(ctx context.Context, opts model.ScreenshotOptions) (string, error)
}
