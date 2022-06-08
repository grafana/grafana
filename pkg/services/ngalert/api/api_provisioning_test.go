package api

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	domain "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/web"
	prometheus "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/require"
)

func TestProvisioningApi(t *testing.T) {
	t.Run("policies", func(t *testing.T) {
		t.Run("successful GET returns 200", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()

			response := sut.RouteGetPolicyTree(&rc)

			require.Equal(t, 200, response.Status())
		})

		t.Run("successful PUT returns 202", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			tree := apimodels.Route{}

			response := sut.RoutePutPolicyTree(&rc, tree)

			require.Equal(t, 202, response.Status())
		})

		t.Run("when new policy tree is invalid", func(t *testing.T) {
			t.Run("PUT returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = &fakeRejectingNotificationPolicyService{}
				rc := createTestRequestCtx()
				tree := apimodels.Route{}

				response := sut.RoutePutPolicyTree(&rc, tree)

				require.Equal(t, 400, response.Status())
				expBody := `{"error":"invalid object specification: invalid policy tree","message":"invalid object specification: invalid policy tree"}`
				require.Equal(t, expBody, string(response.Body()))
			})
		})

		t.Run("when org has no AM config", func(t *testing.T) {
			t.Run("GET returns 404", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rc.SignedInUser.OrgId = 2

				response := sut.RouteGetPolicyTree(&rc)

				require.Equal(t, 404, response.Status())
			})

			t.Run("POST returns 404", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rc.SignedInUser.OrgId = 2

				response := sut.RouteGetPolicyTree(&rc)

				require.Equal(t, 404, response.Status())
			})
		})

		t.Run("when an unspecified error occurrs", func(t *testing.T) {
			t.Run("GET returns 500", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = &fakeFailingNotificationPolicyService{}
				rc := createTestRequestCtx()

				response := sut.RouteGetPolicyTree(&rc)

				require.Equal(t, 500, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "something went wrong")
			})

			t.Run("PUT returns 500", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = &fakeFailingNotificationPolicyService{}
				rc := createTestRequestCtx()
				tree := apimodels.Route{}

				response := sut.RoutePutPolicyTree(&rc, tree)

				require.Equal(t, 500, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "something went wrong")
			})
		})
	})

	t.Run("contact points", func(t *testing.T) {
		t.Run("are invalid", func(t *testing.T) {
			t.Run("POST returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				cp := createInvalidContactPoint()

				response := sut.RoutePostContactPoint(&rc, cp)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "recipient must be specified")
			})

			t.Run("PUT returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				cp := createInvalidContactPoint()

				response := sut.RoutePutContactPoint(&rc, cp)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "recipient must be specified")
			})
		})
	})

	t.Run("templates", func(t *testing.T) {
		t.Run("are invalid", func(t *testing.T) {
			t.Run("PUT returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				withURLParams(rc, namePathParam, "test")
				tmpl := definitions.MessageTemplateContent{Template: ""}

				response := sut.RoutePutTemplate(&rc, tmpl)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "template must have content")
			})
		})
	})

	t.Run("mute timings", func(t *testing.T) {
		t.Run("are invalid", func(t *testing.T) {
			t.Run("POST returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				mti := createInvalidMuteTiming()

				response := sut.RoutePostMuteTiming(&rc, mti)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid")
			})

			t.Run("PUT returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				withURLParams(rc, namePathParam, "interval")
				mti := createInvalidMuteTiming()

				response := sut.RoutePutMuteTiming(&rc, mti)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid")
			})
		})

		t.Run("are missing, PUT returns 404", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			withURLParams(rc, namePathParam, "does not exist")
			mti := apimodels.MuteTimeInterval{}

			response := sut.RoutePutMuteTiming(&rc, mti)

			require.Equal(t, 404, response.Status())
		})
	})
}

func createProvisioningSrvSut(t *testing.T) ProvisioningSrv {
	t.Helper()
	secrets := secrets.NewFakeSecretsService()
	log := log.NewNopLogger()
	configs := &provisioning.MockAMConfigStore{}
	configs.EXPECT().
		GetsConfig(domain.AlertConfiguration{
			AlertmanagerConfiguration: testConfig,
		})

	return ProvisioningSrv{
		log:                 log,
		policies:            newFakeNotificationPolicyService(),
		contactPointService: provisioning.NewContactPointService(configs, secrets, nil, nil, log),
		templates:           provisioning.NewTemplateService(configs, nil, nil, log),
		muteTimings:         provisioning.NewMuteTimingService(configs, nil, nil, log),
	}
}

func createTestRequestCtx() models.ReqContext {
	return models.ReqContext{
		Context: &web.Context{
			Req: &http.Request{},
		},
		SignedInUser: &models.SignedInUser{
			OrgId: 1,
		},
	}
}

func withURLParams(rc models.ReqContext, key, value string) {
	params := web.Params(rc.Req)
	params[key] = value
	rc.Req = web.SetURLParams(rc.Req, params)
}

type fakeNotificationPolicyService struct {
	tree apimodels.Route
	prov domain.Provenance
}

func newFakeNotificationPolicyService() *fakeNotificationPolicyService {
	return &fakeNotificationPolicyService{
		tree: apimodels.Route{
			Receiver: "some-receiver",
		},
		prov: domain.ProvenanceNone,
	}
}

func (f *fakeNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (apimodels.Route, error) {
	if orgID != 1 {
		return apimodels.Route{}, store.ErrNoAlertmanagerConfiguration
	}
	result := f.tree
	result.Provenance = f.prov
	return result, nil
}

func (f *fakeNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree apimodels.Route, p domain.Provenance) error {
	if orgID != 1 {
		return store.ErrNoAlertmanagerConfiguration
	}
	f.tree = tree
	f.prov = p
	return nil
}

type fakeFailingNotificationPolicyService struct{}

func (f *fakeFailingNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (apimodels.Route, error) {
	return apimodels.Route{}, fmt.Errorf("something went wrong")
}

func (f *fakeFailingNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree apimodels.Route, p domain.Provenance) error {
	return fmt.Errorf("something went wrong")
}

type fakeRejectingNotificationPolicyService struct{}

func (f *fakeRejectingNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (apimodels.Route, error) {
	return apimodels.Route{}, nil
}

func (f *fakeRejectingNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree apimodels.Route, p domain.Provenance) error {
	return fmt.Errorf("%w: invalid policy tree", provisioning.ErrValidation)
}

func createInvalidContactPoint() definitions.EmbeddedContactPoint {
	settings, _ := simplejson.NewJson([]byte(`{}`))
	return definitions.EmbeddedContactPoint{
		Name:     "test-contact-point",
		Type:     "slack",
		Settings: settings,
	}
}

func createInvalidTemplate() definitions.MessageTemplate {
	return definitions.MessageTemplate{
		Name:     "",
		Template: "",
	}
}

func createInvalidMuteTiming() definitions.MuteTimeInterval {
	return definitions.MuteTimeInterval{
		MuteTimeInterval: prometheus.MuteTimeInterval{
			Name: "interval",
			TimeIntervals: []timeinterval.TimeInterval{
				{
					Weekdays: []timeinterval.WeekdayRange{
						{
							InclusiveRange: timeinterval.InclusiveRange{
								Begin: -1,
								End:   7,
							},
						},
					},
				},
			},
		},
	}
}

var testConfig = `
{
	"template_files": {
		"a": "template"
	},
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"isDefault": true,
				"settings": {
					"addresses": "<example@email.com>"
				}
			}]
		}],
		"mute_time_intervals": [{
			"name": "interval",
			"time_intervals": []
		}]
	}
}
`
