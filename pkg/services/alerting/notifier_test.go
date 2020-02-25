package alerting

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/services/rendering"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/models"
)

func TestNotificationService(t *testing.T) {
	testRule := &Rule{
		ID:            1,
		DashboardID:   1,
		PanelID:       1,
		OrgID:         1,
		Name:          "Test",
		Message:       "Something is bad",
		State:         models.AlertStateAlerting,
		Notifications: []string{"1"},
	}
	evalCtx := NewEvalContext(context.Background(), testRule)

	notificationServiceScenario(t, "Given alert rule with upload image enabled should render and upload image and send notification", evalCtx, true, func(scenarioCtx *scenarioContext) {
		err := scenarioCtx.notificationService.SendIfNeeded(evalCtx)
		require.NoError(t, err)

		require.Equalf(t, 1, scenarioCtx.renderCount, "expected render to be called, but wasn't")
		require.Equalf(t, 1, scenarioCtx.imageUploadCount, "expected image to be uploaded, but wasn't")
		require.Truef(t, evalCtx.Ctx.Value("notificationSent").(bool), "expected notification to be sent, but wasn't")
	})

	notificationServiceScenario(t, "Given alert rule with upload image disabled should not render and upload image, but send notification", evalCtx, false, func(scenarioCtx *scenarioContext) {
		err := scenarioCtx.notificationService.SendIfNeeded(evalCtx)
		require.NoError(t, err)

		require.Equalf(t, 0, scenarioCtx.renderCount, "expected render not to be called, but it was")
		require.Equalf(t, 0, scenarioCtx.imageUploadCount, "expected image not to be uploaded, but it was")
		require.Truef(t, evalCtx.Ctx.Value("notificationSent").(bool), "expected notification to be sent, but wasn't")
	})

	notificationServiceScenario(t, "Given alert rule with upload image enabled and render times out should send notification", evalCtx, true, func(scenarioCtx *scenarioContext) {
		setting.AlertingNotificationTimeout = 200 * time.Millisecond
		scenarioCtx.renderProvider = func(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error) {
			wait := make(chan bool)

			go func() {
				time.Sleep(1 * time.Second)
				wait <- true
			}()

			select {
			case <-ctx.Done():
				if err := ctx.Err(); err != nil {
					return nil, err
				}
				break
			case <-wait:
			}

			return nil, nil
		}
		err := scenarioCtx.notificationService.SendIfNeeded(evalCtx)
		require.NoError(t, err)

		require.Equalf(t, 0, scenarioCtx.renderCount, "expected render not to be called, but it was")
		require.Equalf(t, 0, scenarioCtx.imageUploadCount, "expected image not to be uploaded, but it was")
		require.Truef(t, evalCtx.Ctx.Value("notificationSent").(bool), "expected notification to be sent, but wasn't")
	})

	notificationServiceScenario(t, "Given alert rule with upload image enabled and upload times out should send notification", evalCtx, true, func(scenarioCtx *scenarioContext) {
		setting.AlertingNotificationTimeout = 200 * time.Millisecond
		scenarioCtx.uploadProvider = func(ctx context.Context, path string) (string, error) {
			wait := make(chan bool)

			go func() {
				time.Sleep(1 * time.Second)
				wait <- true
			}()

			select {
			case <-ctx.Done():
				if err := ctx.Err(); err != nil {
					return "", err
				}
				break
			case <-wait:
			}

			return "", nil
		}
		err := scenarioCtx.notificationService.SendIfNeeded(evalCtx)
		require.NoError(t, err)

		require.Equalf(t, 1, scenarioCtx.renderCount, "expected render to be called, but wasn't")
		require.Equalf(t, 0, scenarioCtx.imageUploadCount, "expected image not to be uploaded, but it was")
		require.Truef(t, evalCtx.Ctx.Value("notificationSent").(bool), "expected notification to be sent, but wasn't")
	})
}

type scenarioContext struct {
	evalCtx             *EvalContext
	notificationService *notificationService
	imageUploadCount    int
	renderCount         int
	uploadProvider      func(ctx context.Context, path string) (string, error)
	renderProvider      func(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error)
}

type scenarioFunc func(c *scenarioContext)

func notificationServiceScenario(t *testing.T, name string, evalCtx *EvalContext, uploadImage bool, fn scenarioFunc) {
	t.Run(name, func(t *testing.T) {
		RegisterNotifier(&NotifierPlugin{
			Type:        "test",
			Name:        "Test",
			Description: "Test notifier",
			Factory:     newTestNotifier,
		})

		evalCtx.dashboardRef = &models.DashboardRef{Uid: "db-uid"}

		bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) error {
			query.Result = []*models.AlertNotification{
				{
					Id:   1,
					Type: "test",
					Settings: simplejson.NewFromAny(map[string]interface{}{
						"uploadImage": uploadImage,
					}),
				},
			}
			return nil
		})

		bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetOrCreateNotificationStateQuery) error {
			query.Result = &models.AlertNotificationState{
				AlertId:                      evalCtx.Rule.ID,
				AlertRuleStateUpdatedVersion: 1,
				Id:                           1,
				OrgId:                        evalCtx.Rule.OrgID,
				State:                        models.AlertNotificationStateUnknown,
			}
			return nil
		})

		bus.AddHandlerCtx("test", func(ctx context.Context, cmd *models.SetAlertNotificationStateToPendingCommand) error {
			return nil
		})

		bus.AddHandlerCtx("test", func(ctx context.Context, cmd *models.SetAlertNotificationStateToCompleteCommand) error {
			return nil
		})

		setting.AlertingNotificationTimeout = 30 * time.Second

		scenarioCtx := &scenarioContext{
			evalCtx: evalCtx,
		}

		uploadProvider := func(ctx context.Context, path string) (string, error) {
			scenarioCtx.imageUploadCount++
			return "", nil
		}

		imageUploader := &testImageUploader{
			uploadProvider: func(ctx context.Context, path string) (string, error) {
				if scenarioCtx.uploadProvider != nil {
					if _, err := scenarioCtx.uploadProvider(ctx, path); err != nil {
						return "", err
					}
				}

				return uploadProvider(ctx, path)
			},
		}

		origNewImageUploaderProvider := newImageUploaderProvider
		newImageUploaderProvider = func() (imguploader.ImageUploader, error) {
			return imageUploader, nil
		}
		defer func() {
			newImageUploaderProvider = origNewImageUploaderProvider
		}()

		renderProvider := func(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error) {
			scenarioCtx.renderCount++
			return &rendering.RenderResult{FilePath: "image.png"}, nil
		}

		renderService := &testRenderService{
			renderProvider: func(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error) {
				if scenarioCtx.renderProvider != nil {
					if _, err := scenarioCtx.renderProvider(ctx, opts); err != nil {
						return nil, err
					}
				}

				return renderProvider(ctx, opts)
			},
		}

		scenarioCtx.notificationService = newNotificationService(renderService)
		fn(scenarioCtx)
	})
}

type testNotifier struct {
	Name                  string
	Type                  string
	UID                   string
	IsDeault              bool
	UploadImage           bool
	SendReminder          bool
	DisableResolveMessage bool
	Frequency             time.Duration
}

func newTestNotifier(model *models.AlertNotification) (Notifier, error) {
	uploadImage := true
	value, exist := model.Settings.CheckGet("uploadImage")
	if exist {
		uploadImage = value.MustBool()
	}

	return &testNotifier{
		UID:                   model.Uid,
		Name:                  model.Name,
		IsDeault:              model.IsDefault,
		Type:                  model.Type,
		UploadImage:           uploadImage,
		SendReminder:          model.SendReminder,
		DisableResolveMessage: model.DisableResolveMessage,
		Frequency:             model.Frequency,
	}, nil
}

func (n *testNotifier) Notify(evalCtx *EvalContext) error {
	evalCtx.Ctx = context.WithValue(evalCtx.Ctx, "notificationSent", true)
	return nil
}

func (n *testNotifier) ShouldNotify(ctx context.Context, evalCtx *EvalContext, notiferState *models.AlertNotificationState) bool {
	return true
}

func (n *testNotifier) GetType() string {
	return n.Type
}

func (n *testNotifier) NeedsImage() bool {
	return n.UploadImage
}

func (n *testNotifier) GetNotifierUID() string {
	return n.UID
}

func (n *testNotifier) GetIsDefault() bool {
	return n.IsDeault
}

func (n *testNotifier) GetSendReminder() bool {
	return n.SendReminder
}

func (n *testNotifier) GetDisableResolveMessage() bool {
	return n.DisableResolveMessage
}

func (n *testNotifier) GetFrequency() time.Duration {
	return n.Frequency
}

var _ Notifier = &testNotifier{}

type testRenderService struct {
	renderProvider           func(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error)
	renderErrorImageProvider func(error error) (*rendering.RenderResult, error)
}

func (s *testRenderService) Render(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error) {
	if s.renderProvider != nil {
		return s.renderProvider(ctx, opts)
	}

	return &rendering.RenderResult{FilePath: "image.png"}, nil
}

func (s *testRenderService) RenderErrorImage(err error) (*rendering.RenderResult, error) {
	if s.renderErrorImageProvider != nil {
		return s.renderErrorImageProvider(err)
	}

	return &rendering.RenderResult{FilePath: "image.png"}, nil
}

func (s *testRenderService) GetRenderUser(key string) (*rendering.RenderUser, bool) {
	return nil, false
}

var _ rendering.Service = &testRenderService{}

type testImageUploader struct {
	uploadProvider func(ctx context.Context, path string) (string, error)
}

func (u *testImageUploader) Upload(ctx context.Context, path string) (string, error) {
	if u.uploadProvider != nil {
		return u.uploadProvider(ctx, path)
	}

	return "", nil
}

var _ imguploader.ImageUploader = &testImageUploader{}
