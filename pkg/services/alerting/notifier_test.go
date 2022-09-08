package alerting

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
)

func TestNotificationService(t *testing.T) {
	testRule := &Rule{Name: "Test", Message: "Something is bad"}
	store := &AlertStoreMock{}
	evalCtx := NewEvalContext(context.Background(), testRule, &validations.OSSPluginRequestValidator{}, store, nil, nil)

	testRuleTemplated := &Rule{Name: "Test latency ${quantile}", Message: "Something is bad on instance ${instance}"}

	evalCtxWithMatch := NewEvalContext(context.Background(), testRuleTemplated, &validations.OSSPluginRequestValidator{}, store, nil, nil)
	evalCtxWithMatch.EvalMatches = []*EvalMatch{{
		Tags: map[string]string{
			"instance": "localhost:3000",
			"quantile": "0.99",
		},
	}}
	evalCtxWithoutMatch := NewEvalContext(context.Background(), testRuleTemplated, &validations.OSSPluginRequestValidator{}, store, nil, nil)

	notificationServiceScenario(t, "Given alert rule with upload image enabled should render and upload image and send notification",
		evalCtx, true, func(sc *scenarioContext) {
			err := sc.notificationService.SendIfNeeded(evalCtx)
			require.NoError(sc.t, err)

			require.Equalf(sc.t, 1, sc.renderCount, "expected render to be called, but wasn't")
			require.Equalf(sc.t, 1, sc.imageUploadCount, "expected image to be uploaded, but wasn't")
			require.Truef(sc.t, evalCtx.Ctx.Value(notificationSent{}).(bool), "expected notification to be sent, but wasn't")
		})

	notificationServiceScenario(t,
		"Given alert rule with upload image enabled but no renderer available should render and upload unavailable image and send notification",
		evalCtx, true, func(sc *scenarioContext) {
			sc.rendererAvailable = false
			err := sc.notificationService.SendIfNeeded(evalCtx)
			require.NoError(sc.t, err)

			require.Equalf(sc.t, 1, sc.renderCount, "expected render to be called, but it wasn't")
			require.Equalf(sc.t, 1, sc.imageUploadCount, "expected image to be uploaded, but it wasn't")
			require.Truef(sc.t, evalCtx.Ctx.Value(notificationSent{}).(bool), "expected notification to be sent, but wasn't")
		})

	notificationServiceScenario(
		t, "Given alert rule with upload image disabled should not render and upload image, but send notification",
		evalCtx, false, func(sc *scenarioContext) {
			err := sc.notificationService.SendIfNeeded(evalCtx)
			require.NoError(t, err)

			require.Equalf(sc.t, 0, sc.renderCount, "expected render not to be called, but it was")
			require.Equalf(sc.t, 0, sc.imageUploadCount, "expected image not to be uploaded, but it was")
			require.Truef(sc.t, evalCtx.Ctx.Value(notificationSent{}).(bool), "expected notification to be sent, but wasn't")
		})

	notificationServiceScenario(t, "Given alert rule with upload image enabled and render times out should send notification",
		evalCtx, true, func(sc *scenarioContext) {
			setting.AlertingNotificationTimeout = 200 * time.Millisecond
			sc.renderProvider = func(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error) {
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
			err := sc.notificationService.SendIfNeeded(evalCtx)
			require.NoError(sc.t, err)

			require.Equalf(sc.t, 0, sc.renderCount, "expected render not to be called, but it was")
			require.Equalf(sc.t, 0, sc.imageUploadCount, "expected image not to be uploaded, but it was")
			require.Truef(sc.t, evalCtx.Ctx.Value(notificationSent{}).(bool), "expected notification to be sent, but wasn't")
		})

	notificationServiceScenario(t, "Given alert rule with upload image enabled and upload times out should send notification",
		evalCtx, true, func(sc *scenarioContext) {
			setting.AlertingNotificationTimeout = 200 * time.Millisecond
			sc.uploadProvider = func(ctx context.Context, path string) (string, error) {
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
			err := sc.notificationService.SendIfNeeded(evalCtx)
			require.NoError(sc.t, err)

			require.Equalf(sc.t, 1, sc.renderCount, "expected render to be called, but wasn't")
			require.Equalf(sc.t, 0, sc.imageUploadCount, "expected image not to be uploaded, but it was")
			require.Truef(sc.t, evalCtx.Ctx.Value(notificationSent{}).(bool), "expected notification to be sent, but wasn't")
		})

	notificationServiceScenario(t, "Given matched alert rule with templated notification fields",
		evalCtxWithMatch, true, func(sc *scenarioContext) {
			err := sc.notificationService.SendIfNeeded(evalCtxWithMatch)
			require.NoError(sc.t, err)

			ctx := evalCtxWithMatch
			require.Equalf(sc.t, 1, sc.renderCount, "expected render to be called, but wasn't")
			require.Equalf(sc.t, 1, sc.imageUploadCount, "expected image to be uploaded, but wasn't")
			require.Truef(sc.t, ctx.Ctx.Value(notificationSent{}).(bool), "expected notification to be sent, but wasn't")
			assert.Equal(t, "Test latency 0.99", ctx.Rule.Name)
			assert.Equal(t, "Something is bad on instance localhost:3000", ctx.Rule.Message)
		})

	notificationServiceScenario(t, "Given unmatched alert rule with templated notification fields",
		evalCtxWithoutMatch, true, func(sc *scenarioContext) {
			err := sc.notificationService.SendIfNeeded(evalCtxWithMatch)
			require.NoError(sc.t, err)

			ctx := evalCtxWithMatch
			require.Equalf(sc.t, 1, sc.renderCount, "expected render to be called, but wasn't")
			require.Equalf(sc.t, 1, sc.imageUploadCount, "expected image to be uploaded, but wasn't")
			require.Truef(sc.t, ctx.Ctx.Value(notificationSent{}).(bool), "expected notification to be sent, but wasn't")
			assert.Equal(t, evalCtxWithoutMatch.Rule.Name, ctx.Rule.Name)
			assert.Equal(t, evalCtxWithoutMatch.Rule.Message, ctx.Rule.Message)
		})
}

type scenarioContext struct {
	t                   *testing.T
	evalCtx             *EvalContext
	notificationService *notificationService
	imageUploadCount    int
	renderCount         int
	uploadProvider      func(ctx context.Context, path string) (string, error)
	renderProvider      func(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error)
	rendererAvailable   bool
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

		store := evalCtx.Store.(*AlertStoreMock)

		store.getAlertNotificationsWithUidToSend = func(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) error {
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
		}

		store.getOrCreateNotificationState = func(ctx context.Context, query *models.GetOrCreateNotificationStateQuery) error {
			query.Result = &models.AlertNotificationState{
				AlertId:                      evalCtx.Rule.ID,
				AlertRuleStateUpdatedVersion: 1,
				Id:                           1,
				OrgId:                        evalCtx.Rule.OrgID,
				State:                        models.AlertNotificationStateUnknown,
			}
			return nil
		}

		setting.AlertingNotificationTimeout = 30 * time.Second

		scenarioCtx := &scenarioContext{
			t:       t,
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

		scenarioCtx.rendererAvailable = true

		renderService := &testRenderService{
			isAvailableProvider: func(ctx context.Context) bool {
				return scenarioCtx.rendererAvailable
			},
			renderProvider: func(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error) {
				if scenarioCtx.renderProvider != nil {
					if _, err := scenarioCtx.renderProvider(ctx, opts); err != nil {
						return nil, err
					}
				}

				return renderProvider(ctx, opts)
			},
		}

		scenarioCtx.notificationService = newNotificationService(renderService, store, nil, nil)
		fn(scenarioCtx)
	})
}

type testNotifier struct {
	Name                  string
	Type                  string
	UID                   string
	IsDefault             bool
	UploadImage           bool
	SendReminder          bool
	DisableResolveMessage bool
	Frequency             time.Duration
}

func newTestNotifier(model *models.AlertNotification, _ GetDecryptedValueFn, ns notifications.Service) (Notifier, error) {
	uploadImage := true
	value, exist := model.Settings.CheckGet("uploadImage")
	if exist {
		uploadImage = value.MustBool()
	}

	return &testNotifier{
		UID:                   model.Uid,
		Name:                  model.Name,
		IsDefault:             model.IsDefault,
		Type:                  model.Type,
		UploadImage:           uploadImage,
		SendReminder:          model.SendReminder,
		DisableResolveMessage: model.DisableResolveMessage,
		Frequency:             model.Frequency,
	}, nil
}

type notificationSent struct{}

func (n *testNotifier) Notify(evalCtx *EvalContext) error {
	evalCtx.Ctx = context.WithValue(evalCtx.Ctx, notificationSent{}, true)
	return nil
}

func (n *testNotifier) ShouldNotify(ctx context.Context, evalCtx *EvalContext, notifierState *models.AlertNotificationState) bool {
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
	return n.IsDefault
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
	isAvailableProvider      func(ctx context.Context) bool
	renderProvider           func(ctx context.Context, opts rendering.Opts) (*rendering.RenderResult, error)
	renderErrorImageProvider func(error error) (*rendering.RenderResult, error)
}

func (s *testRenderService) SanitizeSVG(ctx context.Context, req *rendering.SanitizeSVGRequest) (*rendering.SanitizeSVGResponse, error) {
	return &rendering.SanitizeSVGResponse{Sanitized: req.Content}, nil
}

func (s *testRenderService) HasCapability(_ context.Context, feature rendering.CapabilityName) (rendering.CapabilitySupportRequestResult, error) {
	return rendering.CapabilitySupportRequestResult{}, nil
}

func (s *testRenderService) IsAvailable(ctx context.Context) bool {
	if s.isAvailableProvider != nil {
		return s.isAvailableProvider(ctx)
	}

	return true
}

func (s *testRenderService) Render(ctx context.Context, opts rendering.Opts, session rendering.Session) (*rendering.RenderResult, error) {
	if s.renderProvider != nil {
		return s.renderProvider(ctx, opts)
	}

	return &rendering.RenderResult{FilePath: "image.png"}, nil
}

func (s *testRenderService) RenderCSV(ctx context.Context, opts rendering.CSVOpts, session rendering.Session) (*rendering.RenderCSVResult, error) {
	return nil, nil
}

func (s *testRenderService) RenderErrorImage(theme models.Theme, err error) (*rendering.RenderResult, error) {
	if s.renderErrorImageProvider != nil {
		return s.renderErrorImageProvider(err)
	}

	return &rendering.RenderResult{FilePath: "image.png"}, nil
}

func (s *testRenderService) GetRenderUser(ctx context.Context, key string) (*rendering.RenderUser, bool) {
	return nil, false
}

func (s *testRenderService) Version() string {
	return ""
}

func (s *testRenderService) CreateRenderingSession(ctx context.Context, authOpts rendering.AuthOpts, sessionOpts rendering.SessionOpts) (rendering.Session, error) {
	return nil, nil
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
