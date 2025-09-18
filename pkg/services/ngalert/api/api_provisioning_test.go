package api

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path"
	"strings"
	"testing"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"
	prometheus "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	ngalertfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets"
	secrets_fakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

//go:embed test-data/receiver-exports/*
var receiverExportResponses embed.FS

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationProvisioningApi(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
			tree := definitions.Route{}

			response := sut.RoutePutPolicyTree(&rc, tree)

			require.Equal(t, 202, response.Status())
		})

		t.Run("successful DELETE returns 202", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()

			response := sut.RouteResetPolicyTree(&rc)

			require.Equal(t, 202, response.Status())
		})

		t.Run("when new policy tree is invalid", func(t *testing.T) {
			t.Run("PUT returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = &fakeRejectingNotificationPolicyService{}
				rc := createTestRequestCtx()
				tree := definitions.Route{}

				response := sut.RoutePutPolicyTree(&rc, tree)

				require.Equal(t, 400, response.Status())
				expBody := definitions.ValidationError{Message: "invalid object specification: invalid policy tree"}
				expBodyJSON, marshalErr := json.Marshal(expBody)
				require.NoError(t, marshalErr)
				require.Equal(t, string(expBodyJSON), string(response.Body()))
			})
		})

		t.Run("when org has no AM config", func(t *testing.T) {
			t.Run("GET returns 404", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rc.OrgID = 2

				response := sut.RouteGetPolicyTree(&rc)

				require.Equal(t, 404, response.Status())
			})

			t.Run("POST returns 404", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rc.OrgID = 2

				response := sut.RouteGetPolicyTree(&rc)

				require.Equal(t, 404, response.Status())
			})
		})

		t.Run("when an unspecified error occurs", func(t *testing.T) {
			t.Run("GET returns 500", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = &fakeFailingNotificationPolicyService{}
				rc := createTestRequestCtx()

				response := sut.RouteGetPolicyTree(&rc)

				require.Equal(t, 500, response.Status())
				require.NotEmpty(t, response.Body())
			})

			t.Run("PUT returns 500", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = &fakeFailingNotificationPolicyService{}
				rc := createTestRequestCtx()
				tree := definitions.Route{}

				response := sut.RoutePutPolicyTree(&rc, tree)

				require.Equal(t, 500, response.Status())
				require.NotEmpty(t, response.Body())
			})

			t.Run("DELETE returns 500", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = &fakeFailingNotificationPolicyService{}
				rc := createTestRequestCtx()

				response := sut.RouteResetPolicyTree(&rc)

				require.Equal(t, 500, response.Status())
				require.NotEmpty(t, response.Body())
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

				response := sut.RoutePutContactPoint(&rc, cp, "email-uid")

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "recipient must be specified")
			})
		})

		t.Run("are missing, PUT returns 404", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			cp := createInvalidContactPoint()

			response := sut.RoutePutContactPoint(&rc, cp, "does not exist")

			require.Equal(t, 404, response.Status())
		})
	})

	t.Run("templates", func(t *testing.T) {
		t.Run("are invalid", func(t *testing.T) {
			t.Run("PUT returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				tmpl := definitions.NotificationTemplateContent{Template: ""}

				response := sut.RoutePutTemplate(&rc, tmpl, "test")

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
				mti := createInvalidMuteTiming()

				response := sut.RoutePutMuteTiming(&rc, mti, "interval")

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid")
			})
		})

		t.Run("are missing, PUT returns 404", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			mti := definitions.MuteTimeInterval{}

			response := sut.RoutePutMuteTiming(&rc, mti, "does not exist")

			require.Equal(t, 404, response.Status())
		})
	})

	t.Run("alert rules", func(t *testing.T) {
		t.Run("are invalid", func(t *testing.T) {
			t.Run("POST returns 400 on wrong body params", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule := createInvalidAlertRule()

				response := sut.RoutePostAlertRule(&rc, rule)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid alert rule")
			})

			t.Run("PUT returns 400 on wrong body params", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				uid := "123123"
				rule := createTestAlertRule("rule", 1)
				rule.UID = uid
				insertRule(t, sut, rule)
				rule = createInvalidAlertRule()

				response := sut.RoutePutAlertRule(&rc, rule, uid)
				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid alert rule")
			})

			t.Run("POST returns 400 when folderUID not set", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)
				rule.FolderUID = ""

				response := sut.RoutePostAlertRule(&rc, rule)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid alert rule")
				require.Contains(t, string(response.Body()), "folderUID must be set")
			})

			t.Run("POST returns 400 if folder does not exist", func(t *testing.T) {
				testEnv := createTestEnv(t, testConfig)
				// Create a fake folder service that will return an error when trying to get a folder.
				folderService := foldertest.NewFakeService()
				folderService.ExpectedError = dashboards.ErrFolderNotFound
				testEnv.folderService = folderService
				sut := createProvisioningSrvSutFromEnv(t, &testEnv)

				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)

				response := sut.RoutePostAlertRule(&rc, rule)
				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid alert rule")
				require.Contains(t, string(response.Body()), "folder does not exist")
			})

			t.Run("PUT returns 400 when folderUID not set", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				orgID := int64(1)

				rule := createTestAlertRule("rule", orgID)
				insertRuleInOrg(t, sut, rule, orgID)

				rule.FolderUID = ""

				rc := createTestRequestCtx()
				res := sut.RoutePutAlertRule(&rc, rule, rule.UID)

				require.Equal(t, 400, res.Status())
				require.NotEmpty(t, res.Body())
				require.Contains(t, string(res.Body()), "invalid alert rule")
				require.Contains(t, string(res.Body()), "folderUID must be set")
			})

			t.Run("PUT returns 400 if folder does not exist", func(t *testing.T) {
				testEnv := createTestEnv(t, testConfig)
				sut := createProvisioningSrvSutFromEnv(t, &testEnv)
				orgID := int64(2)

				rule := createTestAlertRule("rule", orgID)
				insertRuleInOrg(t, sut, rule, orgID)
				rule.FolderUID = "does-not-exist"

				rc := createTestRequestCtx()
				res := sut.RoutePutAlertRule(&rc, rule, rule.UID)
				require.Equal(t, 400, res.Status())
				require.NotEmpty(t, res.Body())
				require.Contains(t, string(res.Body()), "invalid alert rule")
				require.Contains(t, string(res.Body()), "folder does not exist")
			})

			t.Run("PUT returns 200 when the alert rule is updated by the admin user", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)
				insertRule(t, sut, rule)
				rule.Title = "new rule title"

				response := sut.RoutePutAlertRule(&rc, rule, rule.UID)
				require.Equal(t, 200, response.Status())
				require.NotEmpty(t, response.Body())
				updated := deserializeRule(t, response.Body())
				require.Equal(t, rule.UID, updated.UID)
				require.Equal(t, rule.Title, updated.Title)
			})

			t.Run("PUT returns 404 when the UID is not specified", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)
				response := sut.RoutePutAlertRule(&rc, rule, "")
				require.Equal(t, 404, response.Status())
			})

			t.Run("PUT returns 200 when the alert rule has not changed", func(t *testing.T) {
				env := createTestEnv(t, testConfig)
				env.ac = &recordingAccessControlFake{
					Callback: func(user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
						if strings.Contains(evaluator.String(), accesscontrol.ActionAlertingRulesProvisioningWrite) || strings.Contains(evaluator.String(), accesscontrol.ActionAlertingProvisioningWrite) {
							return false, nil
						}
						return true, nil
					},
				}

				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)
				insertRule(t, sut, rule)

				response := sut.RoutePutAlertRule(&rc, rule, rule.UID)
				require.Equal(t, 200, response.Status())
				require.NotEmpty(t, response.Body())
				updated := deserializeRule(t, response.Body())
				require.Equal(t, rule.UID, updated.UID)
			})

			t.Run("PUT without MissingSeriesEvalsToResolve clears the field", func(t *testing.T) {
				oldValue := util.Pointer[int64](5)
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)
				rule.MissingSeriesEvalsToResolve = oldValue
				insertRule(t, sut, rule)
				rule.MissingSeriesEvalsToResolve = nil

				response := sut.RoutePutAlertRule(&rc, rule, rule.UID)
				require.Equal(t, 200, response.Status(), string(response.Body()))
				require.NotEmpty(t, response.Body())
				updated := deserializeRule(t, response.Body())
				require.Equal(t, rule.UID, updated.UID)
				require.Nil(t, updated.MissingSeriesEvalsToResolve)
			})

			t.Run("PUT with MissingSeriesEvalsToResolve updates the value", func(t *testing.T) {
				oldValue := util.Pointer[int64](5)
				newValue := util.Pointer[int64](10)
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)
				rule.MissingSeriesEvalsToResolve = oldValue
				insertRule(t, sut, rule)
				rule.MissingSeriesEvalsToResolve = newValue

				response := sut.RoutePutAlertRule(&rc, rule, rule.UID)
				require.Equal(t, 200, response.Status(), string(response.Body()))
				require.NotEmpty(t, response.Body())
				updated := deserializeRule(t, response.Body())
				require.Equal(t, rule.UID, updated.UID)
				require.NotNil(t, updated.MissingSeriesEvalsToResolve)
				require.Equal(t, *newValue, *updated.MissingSeriesEvalsToResolve)
			})
		})

		t.Run("exist in non-default orgs", func(t *testing.T) {
			t.Run("POST sets expected fields with no provenance", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rc.Req.Header = map[string][]string{"X-Disable-Provenance": {"true"}}
				rc.OrgID = 3
				rule := createTestAlertRule("rule", 1)
				rule.FolderUID = "folder-uid3"

				response := sut.RoutePostAlertRule(&rc, rule)

				require.Equal(t, 201, response.Status())
				created := deserializeRule(t, response.Body())
				require.Equal(t, int64(3), created.OrgID)
				require.Equal(t, definitions.Provenance(models.ProvenanceNone), created.Provenance)
			})

			t.Run("PUT sets expected fields with no provenance", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				uid := util.GenerateShortUID()
				rule := createTestAlertRule("rule", 1)
				rule.UID = uid

				orgID := int64(3)
				rule.FolderUID = "folder-uid3"

				insertRuleInOrg(t, sut, rule, orgID)
				rc := createTestRequestCtx()
				rc.Req.Header = map[string][]string{"X-Disable-Provenance": {"hello"}}
				rc.OrgID = 3
				rule.OrgID = 1 // Set the org back to something wrong, we should still prefer the value from the req context.

				response := sut.RoutePutAlertRule(&rc, rule, rule.UID)

				require.Equal(t, 200, response.Status())
				created := deserializeRule(t, response.Body())
				require.Equal(t, int64(3), created.OrgID)
				require.Equal(t, definitions.Provenance(models.ProvenanceNone), created.Provenance)
			})
		})

		t.Run("are missing, PUT returns 404", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			rule := createTestAlertRule("rule", 1)

			response := sut.RoutePutAlertRule(&rc, rule, "does not exist")

			require.Equal(t, 404, response.Status())
		})

		t.Run("are missing, GET returns 404", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			response := sut.RouteRouteGetAlertRule(&rc, "does not exist")

			require.Equal(t, 404, response.Status())
		})

		t.Run("have reached the rule quota, POST returns 403", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			quotas := provisioning.MockQuotaChecker{}
			quotas.EXPECT().LimitExceeded()
			env.quotas = &quotas
			sut := createProvisioningSrvSutFromEnv(t, &env)
			rule := createTestAlertRule("rule", 1)
			rc := createTestRequestCtx()

			response := sut.RoutePostAlertRule(&rc, rule)

			require.Equal(t, 403, response.Status())
		})

		t.Run("with notification settings", func(t *testing.T) {
			t.Run("POST returns 400 when receiver does not exist", func(t *testing.T) {
				env := createTestEnv(t, testConfig)
				env.nsValidator = &fakeRejectingNotificationSettingsValidatorProvider{}
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)
				rule.NotificationSettings.Receiver = "non-existent-receiver"

				response := sut.RoutePostAlertRule(&rc, rule)

				require.Equal(t, 400, response.Status())
				require.Contains(t, string(response.Body()), "receiver non-existent-receiver does not exist")
			})

			t.Run("PUT returns 400 when receiver does not exist", func(t *testing.T) {
				env := createTestEnv(t, testConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)
				rule.UID = "test-uid"
				insertRule(t, sut, rule)

				env.nsValidator = &fakeRejectingNotificationSettingsValidatorProvider{}
				sut = createProvisioningSrvSutFromEnv(t, &env)
				rule.NotificationSettings.Receiver = "non-existent-receiver"

				response := sut.RoutePutAlertRule(&rc, rule, rule.UID)

				require.Equal(t, 400, response.Status())
				require.Contains(t, string(response.Body()), "receiver non-existent-receiver does not exist")
			})

			t.Run("POST returns 201 when receiver exists", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)

				response := sut.RoutePostAlertRule(&rc, rule)

				require.Equal(t, 201, response.Status())
			})

			t.Run("PUT returns 200 when receiver exists", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule := createTestAlertRule("rule", 1)
				rule.UID = "test-uid-2"
				insertRule(t, sut, rule)
				rule.Title = "updated rule"

				response := sut.RoutePutAlertRule(&rc, rule, rule.UID)

				require.Equal(t, 200, response.Status())
			})
		})
	})

	t.Run("recording rules", func(t *testing.T) {
		env := createTestEnv(t, testConfig)

		t.Run("POST returns 201", func(t *testing.T) {
			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()
			rule := createTestRecordingRule("rule", 1)

			response := sut.RoutePostAlertRule(&rc, rule)

			require.Equal(t, 201, response.Status())
		})

		t.Run("PUT returns 200", func(t *testing.T) {
			sut := createProvisioningSrvSutFromEnv(t, &env)
			uid := util.GenerateShortUID()
			rule := createTestAlertRule("rule", 3)
			rule.UID = uid
			rule.FolderUID = "folder-uid3"

			insertRuleInOrg(t, sut, rule, 3)

			// make rule a recording rule
			rule.Record = &definitions.Record{
				Metric: "test_metric",
				From:   "A",
			}

			rc := createTestRequestCtx()
			rc.OrgID = 3

			response := sut.RoutePutAlertRule(&rc, rule, rule.UID)

			require.Equal(t, 200, response.Status())
		})
	})

	t.Run("alert rule groups", func(t *testing.T) {
		t.Run("are present", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			insertRule(t, sut, createTestAlertRule("rule", 1))

			t.Run("GET returns 200", func(t *testing.T) {
				response := sut.RouteGetAlertRuleGroup(&rc, "folder-uid", "my-cool-group")

				require.Equal(t, 200, response.Status())
			})

			t.Run("DELETE returns 204", func(t *testing.T) {
				response := sut.RouteDeleteAlertRuleGroup(&rc, "folder-uid", "my-cool-group")

				require.Equal(t, 204, response.Status())
			})
		})

		t.Run("are missing", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			insertRule(t, sut, createTestAlertRule("rule", 1))

			t.Run("GET returns 404", func(t *testing.T) {
				response := sut.RouteGetAlertRuleGroup(&rc, "folder-uid", "does not exist")

				require.Equal(t, 404, response.Status())
			})

			t.Run("DELETE returns 404", func(t *testing.T) {
				response := sut.RouteDeleteAlertRuleGroup(&rc, "folder-uid", "does not exist")

				require.Equal(t, 404, response.Status())
			})
		})

		t.Run("are invalid at group level", func(t *testing.T) {
			t.Run("PUT returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))
				group := createInvalidAlertRuleGroup()
				group.Interval = 0

				response := sut.RoutePutAlertRuleGroup(&rc, group, "folder-uid", group.Title)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid alert rule")
			})
		})

		t.Run("are invalid at rule level", func(t *testing.T) {
			t.Run("PUT returns 400", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))
				group := createInvalidAlertRuleGroup()

				response := sut.RoutePutAlertRuleGroup(&rc, group, "folder-uid", group.Title)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid alert rule")
			})

			t.Run("PUT returns 400 when the alert rule has invalid queries", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				group := definitions.AlertRuleGroup{
					Title:    "test rule group",
					Interval: 60,
					Rules: []definitions.ProvisionedAlertRule{
						createTestAlertRule("rule", 1),
					},
				}
				// Set an invalid query model that will fail PreSave validation
				// Invalid JSON should trigger unmarshal error in PreSave
				group.Rules[0].Data[0].Model = json.RawMessage(`{invalid json`)

				response := sut.RoutePutAlertRuleGroup(&rc, group, "folder-uid", group.Title)

				require.Equal(t, 400, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "invalid alert rule")
				require.Contains(t, string(response.Body()), "invalid alert query")
			})
		})

		t.Run("have reached the rule quota, PUT returns 403", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			quotas := provisioning.MockQuotaChecker{}
			quotas.EXPECT().LimitExceeded()
			env.quotas = &quotas
			sut := createProvisioningSrvSutFromEnv(t, &env)
			group := createTestAlertRuleGroup(1)
			rc := createTestRequestCtx()

			response := sut.RoutePutAlertRuleGroup(&rc, group, "folder-uid", group.Title)

			require.Equal(t, 403, response.Status())
		})

		t.Run("are valid", func(t *testing.T) {
			t.Run("PUT returns 200", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				group := createTestAlertRuleGroup(1)

				response := sut.RoutePutAlertRuleGroup(&rc, group, "folder-uid", group.Title)

				require.Equal(t, 200, response.Status())
				require.NotEmpty(t, response.Body())

				updated := deserializeRuleGroup(t, response.Body())
				require.Equal(t, group.Title, updated.Title)
			})

			t.Run("PUT with MissingSeriesEvalsToResolve updates the value", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				group := createTestAlertRuleGroup(1)

				response := sut.RoutePutAlertRuleGroup(&rc, group, "folder-uid", group.Title)
				updated := deserializeRuleGroup(t, response.Body())
				require.Nil(t, updated.Rules[0].MissingSeriesEvalsToResolve)

				// Put the same group with a new value
				group.Rules[0].MissingSeriesEvalsToResolve = util.Pointer[int64](5)
				response = sut.RoutePutAlertRuleGroup(&rc, group, "folder-uid", group.Title)
				require.Equal(t, 200, response.Status())
				updated = deserializeRuleGroup(t, response.Body())
				require.NotNil(t, updated.Rules[0].MissingSeriesEvalsToResolve)
				require.Equal(t, int64(5), *updated.Rules[0].MissingSeriesEvalsToResolve)

				// Reset the value again
				group.Rules[0].MissingSeriesEvalsToResolve = nil
				response = sut.RoutePutAlertRuleGroup(&rc, group, "folder-uid", group.Title)
				require.Equal(t, 200, response.Status())
				updated = deserializeRuleGroup(t, response.Body())
				require.Nil(t, updated.Rules[0].MissingSeriesEvalsToResolve)
			})
		})
	})

	t.Run("exports", func(t *testing.T) {
		t.Run("alert rule group", func(t *testing.T) {
			t.Run("are present, GET returns 200", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")

				require.Equal(t, 200, response.Status())
			})

			t.Run("are missing, GET returns 404", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "does not exist")

				require.Equal(t, 404, response.Status())
			})

			t.Run("accept header contains yaml, GET returns text yaml", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Header.Add("Accept", "application/yaml")
				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query format contains yaml, GET returns text yaml", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Form.Set("format", "yaml")

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query format contains unknown value, GET returns text yaml", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Form.Set("format", "foo")

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Header.Add("Accept", "application/json, application/yaml")
				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Form.Set("download", "true")
				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
			})

			t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Form.Set("download", "false")
				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("query param download not set, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("yaml body content is the default", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule1 := createTestAlertRule("rule1", 1)
				rule1.NotificationSettings = nil
				insertRule(t, sut, rule1)
				insertRule(t, sut, createTestAlertRule("rule2", 1))

				expectedResponse := "apiVersion: 1\ngroups:\n    - orgId: 1\n      name: my-cool-group\n      folder: Folder Title\n      interval: 1m\n      rules:\n        - uid: rule1\n          title: rule1\n          condition: A\n          data:\n            - refId: A\n              relativeTimeRange:\n                from: 60\n                to: 0\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n        - uid: rule2\n          title: rule2\n          condition: A\n          data:\n            - refId: A\n              relativeTimeRange:\n                from: 60\n                to: 0\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n          notification_settings:\n            receiver: Test-Receiver\n            group_by:\n                - alertname\n                - grafana_folder\n                - test\n            group_wait: 1s\n            group_interval: 5s\n            repeat_interval: 5m\n            mute_time_intervals:\n                - test-mute\n            active_time_intervals:\n                - test-active\n"

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("json body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule1 := createTestAlertRule("rule1", 1)
				rule1.NotificationSettings = nil
				insertRule(t, sut, rule1)
				insertRule(t, sut, createTestAlertRule("rule2", 1))

				rc.Req.Header.Add("Accept", "application/json")
				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"my-cool-group","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false},{"uid":"rule2","title":"rule2","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]}]}`

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("yaml body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))
				insertRule(t, sut, createTestAlertRule("rule2", 1))

				rc.Req.Header.Add("Accept", "application/yaml")
				expectedResponse := "apiVersion: 1\ngroups:\n    - orgId: 1\n      name: my-cool-group\n      folder: Folder Title\n      interval: 1m\n      rules:\n        - uid: rule1\n          title: rule1\n          condition: A\n          data:\n            - refId: A\n              relativeTimeRange:\n                from: 60\n                to: 0\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n          notification_settings:\n            receiver: Test-Receiver\n            group_by:\n                - alertname\n                - grafana_folder\n                - test\n            group_wait: 1s\n            group_interval: 5s\n            repeat_interval: 5m\n            mute_time_intervals:\n                - test-mute\n            active_time_intervals:\n                - test-active\n        - uid: rule2\n          title: rule2\n          condition: A\n          data:\n            - refId: A\n              relativeTimeRange:\n                from: 60\n                to: 0\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n          notification_settings:\n            receiver: Test-Receiver\n            group_by:\n                - alertname\n                - grafana_folder\n                - test\n            group_wait: 1s\n            group_interval: 5s\n            repeat_interval: 5m\n            mute_time_intervals:\n                - test-mute\n            active_time_intervals:\n                - test-active\n"

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("hcl body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rule1 := createTestAlertRule("rule1", 1)
				rule1.Labels = map[string]string{
					"test": "label",
				}
				rule1.Annotations = map[string]string{
					"test": "annotation",
				}
				rule1.NoDataState = definitions.Alerting
				rule1.ExecErrState = definitions.ErrorErrState
				rule1.NotificationSettings = nil
				insertRule(t, sut, rule1)
				insertRule(t, sut, createTestAlertRule("rule2", 1))

				expectedResponse := `resource "grafana_rule_group" "rule_group_cc0954af8a53fa18" {
  org_id           = 1
  name             = "my-cool-group"
  folder_uid       = "folder-uid"
  interval_seconds = 60

  rule {
    name      = "rule1"
    condition = "A"

    data {
      ref_id = "A"

      relative_time_range {
        from = 60
        to   = 0
      }

      datasource_uid = ""
      model          = "{\"conditions\":[{\"evaluator\":{\"params\":[3],\"type\":\"gt\"},\"operator\":{\"type\":\"and\"},\"query\":{\"params\":[\"A\"]},\"reducer\":{\"type\":\"last\"},\"type\":\"query\"}],\"datasource\":{\"type\":\"__expr__\",\"uid\":\"__expr__\"},\"expression\":\"1==0\",\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"math\"}"
    }

    no_data_state  = "Alerting"
    exec_err_state = "Error"
    for            = "0s"
    annotations = {
      test = "annotation"
    }
    labels = {
      test = "label"
    }
    is_paused = false
  }
  rule {
    name      = "rule2"
    condition = "A"

    data {
      ref_id = "A"

      relative_time_range {
        from = 60
        to   = 0
      }

      datasource_uid = ""
      model          = "{\"conditions\":[{\"evaluator\":{\"params\":[3],\"type\":\"gt\"},\"operator\":{\"type\":\"and\"},\"query\":{\"params\":[\"A\"]},\"reducer\":{\"type\":\"last\"},\"type\":\"query\"}],\"datasource\":{\"type\":\"__expr__\",\"uid\":\"__expr__\"},\"expression\":\"1==0\",\"intervalMs\":1000,\"maxDataPoints\":43200,\"refId\":\"A\",\"type\":\"math\"}"
    }

    no_data_state  = "OK"
    exec_err_state = "OK"
    for            = "0s"
    is_paused      = false

    notification_settings {
      contact_point   = "Test-Receiver"
      group_by        = ["alertname", "grafana_folder", "test"]
      group_wait      = "1s"
      group_interval  = "5s"
      repeat_interval = "5m"
      mute_timings    = ["test-mute"]
      active_timings  = ["test-active"]
    }
  }
}
`
				rc := createTestRequestCtx()
				rc.Req.Form.Set("format", "hcl")
				rc.Req.Form.Set("download", "false")

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
				require.Equal(t, "text/hcl", rc.Resp.Header().Get("Content-Type"))

				t.Run("and add specific headers if download=true", func(t *testing.T) {
					rc := createTestRequestCtx()
					rc.Req.Form.Set("format", "hcl")
					rc.Req.Form.Set("download", "true")

					response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
					response.WriteTo(&rc)

					require.Equal(t, 200, response.Status())
					require.Equal(t, expectedResponse, string(response.Body()))
					require.Equal(t, "application/terraform+hcl", rc.Resp.Header().Get("Content-Type"))
					require.Equal(t, `attachment;filename=export.tf`, rc.Resp.Header().Get("Content-Disposition"))
				})
			})
		})

		t.Run("alert rule", func(t *testing.T) {
			t.Run("are present, GET returns 200", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				response := sut.RouteGetAlertRuleExport(&rc, "rule1")

				require.Equal(t, 200, response.Status())
			})

			t.Run("are missing, GET returns 404", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				response := sut.RouteGetAlertRuleExport(&rc, "rule404")

				require.Equal(t, 404, response.Status())
			})

			t.Run("accept header contains yaml, GET returns text yaml", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Req.Header.Add("Accept", "application/yaml")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Req.Header.Add("Accept", "application/json, application/yaml")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Req.Form.Set("download", "true")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
			})

			t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Req.Form.Set("download", "false")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("query param download not set, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("json body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"my-cool-group","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]}]}`

				rc.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("yaml body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Req.Header.Add("Accept", "application/yaml")
				expectedResponse := "apiVersion: 1\ngroups:\n    - orgId: 1\n      name: my-cool-group\n      folder: Folder Title\n      interval: 1m\n      rules:\n        - uid: rule1\n          title: rule1\n          condition: A\n          data:\n            - refId: A\n              relativeTimeRange:\n                from: 60\n                to: 0\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n          notification_settings:\n            receiver: Test-Receiver\n            group_by:\n                - alertname\n                - grafana_folder\n                - test\n            group_wait: 1s\n            group_interval: 5s\n            repeat_interval: 5m\n            mute_time_intervals:\n                - test-mute\n            active_time_intervals:\n                - test-active\n"

				response := sut.RouteGetAlertRuleExport(&rc, "rule1")

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
		})

		t.Run("all alert rules", func(t *testing.T) {
			t.Run("are present, GET returns 200", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				response := sut.RouteGetAlertRulesExport(&rc)

				require.Equal(t, 200, response.Status())
			})

			t.Run("accept header contains yaml, GET returns text yaml", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Header.Add("Accept", "application/yaml")
				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Header.Add("Accept", "application/json, application/yaml")
				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Form.Set("download", "true")
				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
			})

			t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Req.Form.Set("download", "false")
				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("query param download not set, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("json body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule1 := createTestAlertRuleWithFolderAndGroup("rule1", 1, "folder-uid", "groupa")
				rule1.NotificationSettings = nil
				rule2 := createTestAlertRuleWithFolderAndGroup("rule2", 1, "folder-uid", "groupb")
				rule1.NotificationSettings = &definitions.AlertRuleNotificationSettings{Receiver: "Email"}
				rule3 := createTestAlertRuleWithFolderAndGroup("rule3", 1, "folder-uid2", "groupb")
				insertRule(t, sut, rule1)
				insertRule(t, sut, rule2)
				insertRule(t, sut, rule3)

				rc.Req.Header.Add("Accept", "application/json")
				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"groupa","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Email"}}]},{"orgId":1,"name":"groupb","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule2","title":"rule2","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]},{"orgId":1,"name":"groupb","folder":"Folder Title2","interval":"1m","rules":[{"uid":"rule3","title":"rule3","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]}]}`

				response := sut.RouteGetAlertRulesExport(&rc)
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("yaml body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rule1 := createTestAlertRuleWithFolderAndGroup("rule1", 1, "folder-uid", "groupa")
				rule1.NotificationSettings = nil
				rule2 := createTestAlertRuleWithFolderAndGroup("rule2", 1, "folder-uid", "groupb")
				rule1.NotificationSettings = &definitions.AlertRuleNotificationSettings{Receiver: "Email"}
				rule3 := createTestAlertRuleWithFolderAndGroup("rule3", 1, "folder-uid2", "groupb")
				insertRule(t, sut, rule1)
				insertRule(t, sut, rule2)
				insertRule(t, sut, rule3)

				rc.Req.Header.Add("Accept", "application/yaml")
				expectedResponse := "apiVersion: 1\ngroups:\n    - orgId: 1\n      name: groupa\n      folder: Folder Title\n      interval: 1m\n      rules:\n        - uid: rule1\n          title: rule1\n          condition: A\n          data:\n            - refId: A\n              relativeTimeRange:\n                from: 60\n                to: 0\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n          notification_settings:\n            receiver: Email\n    - orgId: 1\n      name: groupb\n      folder: Folder Title\n      interval: 1m\n      rules:\n        - uid: rule2\n          title: rule2\n          condition: A\n          data:\n            - refId: A\n              relativeTimeRange:\n                from: 60\n                to: 0\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n          notification_settings:\n            receiver: Test-Receiver\n            group_by:\n                - alertname\n                - grafana_folder\n                - test\n            group_wait: 1s\n            group_interval: 5s\n            repeat_interval: 5m\n            mute_time_intervals:\n                - test-mute\n            active_time_intervals:\n                - test-active\n    - orgId: 1\n      name: groupb\n      folder: Folder Title2\n      interval: 1m\n      rules:\n        - uid: rule3\n          title: rule3\n          condition: A\n          data:\n            - refId: A\n              relativeTimeRange:\n                from: 60\n                to: 0\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n          notification_settings:\n            receiver: Test-Receiver\n            group_by:\n                - alertname\n                - grafana_folder\n                - test\n            group_wait: 1s\n            group_interval: 5s\n            repeat_interval: 5m\n            mute_time_intervals:\n                - test-mute\n            active_time_intervals:\n                - test-active\n"

				response := sut.RouteGetAlertRulesExport(&rc)
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("accept query parameter folder_uid", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule1", 1, "folder-uid", "groupa"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule2", 1, "folder-uid", "groupb"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule3", 1, "folder-uid2", "groupb"))

				rc.Req.Header.Add("Accept", "application/json")
				rc.Req.Form.Set("folderUid", "folder-uid")
				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"groupa","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]},{"orgId":1,"name":"groupb","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule2","title":"rule2","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]}]}`

				response := sut.RouteGetAlertRulesExport(&rc)
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("accept multiple query parameters folder_uid", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule1", 1, "folder-uid", "groupa"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule2", 1, "folder-uid", "groupb"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule3", 1, "folder-uid2", "groupb"))

				rc.Req.Header.Add("Accept", "application/json")
				rc.Req.Form.Set("folder_uid", "folder-uid")
				rc.Req.Form.Add("folder_uid", "folder-uid2")
				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"groupa","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]},{"orgId":1,"name":"groupb","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule2","title":"rule2","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]},{"orgId":1,"name":"groupb","folder":"Folder Title2","interval":"1m","rules":[{"uid":"rule3","title":"rule3","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]}]}`

				response := sut.RouteGetAlertRulesExport(&rc)
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("accepts parameter group", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule1", 1, "folder-uid", "groupa"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule2", 1, "folder-uid", "groupb"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule3", 1, "folder-uid2", "groupb"))

				rc := createTestRequestCtx()
				rc.Req.Header.Add("Accept", "application/json")
				rc.Req.Form.Set("folderUid", "folder-uid")
				rc.Req.Form.Set("group", "groupa")

				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"groupa","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]}]}`

				response := sut.RouteGetAlertRulesExport(&rc)
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))

				t.Run("and fails if folderUID is empty", func(t *testing.T) {
					rc := createTestRequestCtx()
					rc.Req.Header.Add("Accept", "application/json")
					rc.Req.Form.Set("group", "groupa")
					rc.Req.Form.Set("folderUid", "")
					response := sut.RouteGetAlertRulesExport(&rc)

					require.Equal(t, 400, response.Status())
				})

				t.Run("and fails if multiple folder UIDs are specified", func(t *testing.T) {
					rc := createTestRequestCtx()
					rc.Req.Header.Add("Accept", "application/json")
					rc.Req.Form.Set("group", "groupa")
					rc.Req.Form.Set("folderUid", "folder-uid")
					rc.Req.Form.Add("folderUid", "folder-uid2")
					response := sut.RouteGetAlertRulesExport(&rc)

					require.Equal(t, 400, response.Status())
				})
			})

			t.Run("accepts parameter ruleUid", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule1", 1, "folder-uid", "groupa"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule2", 1, "folder-uid", "groupa"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule3", 1, "folder-uid2", "groupb"))

				rc := createTestRequestCtx()
				rc.Req.Header.Add("Accept", "application/json")
				rc.Req.Form.Set("ruleUid", "rule1")

				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"groupa","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":60,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false,"notification_settings":{"receiver":"Test-Receiver","group_by":["alertname","grafana_folder","test"],"group_wait":"1s","group_interval":"5s","repeat_interval":"5m","mute_time_intervals":["test-mute"],"active_time_intervals":["test-active"]}}]}]}`

				response := sut.RouteGetAlertRulesExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))

				t.Run("and fails if folderUID and group are specified", func(t *testing.T) {
					rc := createTestRequestCtx()
					rc.Req.Header.Add("Accept", "application/json")
					rc.Req.Form.Set("group", "groupa")
					rc.Req.Form.Set("folderUid", "folder-uid")
					rc.Req.Form.Set("ruleUid", "rule1")
					response := sut.RouteGetAlertRulesExport(&rc)

					require.Equal(t, 400, response.Status())
				})

				t.Run("and fails if only folderUID is specified", func(t *testing.T) {
					rc := createTestRequestCtx()
					rc.Req.Header.Add("Accept", "application/json")
					rc.Req.Form.Set("folderUid", "folder-uid")
					rc.Req.Form.Set("ruleUid", "rule2")
					response := sut.RouteGetAlertRulesExport(&rc)

					require.Equal(t, 400, response.Status())
				})
			})
		})

		t.Run("notification policies", func(t *testing.T) {
			t.Run("are present, GET returns 200", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				response := sut.RouteGetPolicyTreeExport(&rc)

				require.Equal(t, 200, response.Status())
			})

			t.Run("accept header contains yaml, GET returns text yaml", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/yaml")
				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json, application/yaml")
				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Form.Set("download", "true")
				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
			})

			t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Form.Set("download", "false")
				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("query param download not set, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("json body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = createFakeNotificationPolicyService()
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json")
				expectedResponse := `{"apiVersion":1,"policies":[{"orgId":1,"receiver":"default-receiver","group_by":["g1","g2"],"routes":[{"receiver":"nested-receiver","group_by":["g3","g4"],"matchers":["a=\"b\""],"object_matchers":[["foo","=","bar"]],"mute_time_intervals":["interval"],"active_time_intervals":["active"],"continue":true,"group_wait":"5m","group_interval":"5m","repeat_interval":"5m"}],"group_wait":"30s","group_interval":"5m","repeat_interval":"1h"}]}`

				response := sut.RouteGetPolicyTreeExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("yaml body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = createFakeNotificationPolicyService()
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/yaml")
				expectedResponse := "apiVersion: 1\npolicies:\n    - orgId: 1\n      receiver: default-receiver\n      group_by:\n        - g1\n        - g2\n      routes:\n        - receiver: nested-receiver\n          group_by:\n            - g3\n            - g4\n          matchers:\n            - a=\"b\"\n          object_matchers:\n            - - foo\n              - =\n              - bar\n          mute_time_intervals:\n            - interval\n          active_time_intervals:\n            - active\n          continue: true\n          group_wait: 5m\n          group_interval: 5m\n          repeat_interval: 5m\n      group_wait: 30s\n      group_interval: 5m\n      repeat_interval: 1h\n"

				response := sut.RouteGetPolicyTreeExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("hcl body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = createFakeNotificationPolicyService()
				rc := createTestRequestCtx()

				rc.Req.Form.Add("format", "hcl")
				expectedResponse := "resource \"grafana_notification_policy\" \"notification_policy_1\" {\n  contact_point = \"default-receiver\"\n  group_by      = [\"g1\", \"g2\"]\n\n  policy {\n    contact_point = \"nested-receiver\"\n    group_by      = [\"g3\", \"g4\"]\n\n    matcher {\n      label = \"foo\"\n      match = \"=\"\n      value = \"bar\"\n    }\n\n    mute_timings    = [\"interval\"]\n    active_timings  = [\"active\"]\n    continue        = true\n    group_wait      = \"5m\"\n    group_interval  = \"5m\"\n    repeat_interval = \"5m\"\n  }\n\n  group_wait      = \"30s\"\n  group_interval  = \"5m\"\n  repeat_interval = \"1h\"\n}\n"

				response := sut.RouteGetPolicyTreeExport(&rc)

				t.Log(string(response.Body()))
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("hcl contains required group_by field", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Form.Add("format", "hcl")
				expectedResponse := "resource \"grafana_notification_policy\" \"notification_policy_1\" {\n" +
					"  contact_point = \"some-receiver\"\n" +
					"  group_by      = []\n" +
					"}\n"

				response := sut.RouteGetPolicyTreeExport(&rc)

				t.Log(string(response.Body()))
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
		})

		t.Run("mute timings", func(t *testing.T) {
			t.Run("are present, GET returns 200", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				response := sut.RouteGetMuteTimingsExport(&rc)

				require.Equal(t, 200, response.Status())
			})

			t.Run("accept header contains yaml, GET returns text yaml", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/yaml")
				response := sut.RouteGetMuteTimingsExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetMuteTimingsExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json, application/yaml")
				response := sut.RouteGetMuteTimingsExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Form.Set("download", "true")
				response := sut.RouteGetMuteTimingsExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
			})

			t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Req.Form.Set("download", "false")
				response := sut.RouteGetMuteTimingsExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("query param download not set, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				response := sut.RouteGetMuteTimingsExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
			})

			t.Run("json body content is as expected", func(t *testing.T) {
				expectedResponse, err := testData.ReadFile(path.Join("test-data", "alertmanager_default_mutetimings-export.json"))
				require.NoError(t, err)
				sut := createProvisioningSrvSut(t)
				sut.policies = createFakeNotificationPolicyService()
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetMuteTimingsExport(&rc)

				require.Equal(t, 200, response.Status())
				require.JSONEq(t, string(expectedResponse), string(response.Body()))
			})

			t.Run("yaml body content is as expected", func(t *testing.T) {
				expectedResponse, err := testData.ReadFile(path.Join("test-data", "alertmanager_default_mutetimings-export.yaml"))
				require.NoError(t, err)
				sut := createProvisioningSrvSut(t)
				sut.policies = createFakeNotificationPolicyService()
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/yaml")

				response := sut.RouteGetMuteTimingsExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, string(expectedResponse), string(response.Body()))
			})

			t.Run("hcl body content is as expected", func(t *testing.T) {
				expectedResponse, err := testData.ReadFile(path.Join("test-data", "alertmanager_default_mutetimings-export.hcl"))
				require.NoError(t, err)
				sut := createProvisioningSrvSut(t)
				sut.policies = createFakeNotificationPolicyService()
				rc := createTestRequestCtx()

				rc.Req.Form.Add("format", "hcl")

				response := sut.RouteGetMuteTimingsExport(&rc)
				t.Log(string(response.Body()))
				require.Equal(t, 200, response.Status())
				require.Equal(t, string(expectedResponse), string(response.Body()))
			})
		})
	})
}

func TestIntegrationProvisioningApiContactPointExport(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	createTestEnv := func(t *testing.T, testConfig string) testEnvironment {
		env := createTestEnv(t, testConfig)
		env.ac = &recordingAccessControlFake{
			Callback: func(user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
				if strings.Contains(evaluator.String(), accesscontrol.ActionAlertingNotificationsRead) {
					return true, nil
				}
				if strings.Contains(evaluator.String(), accesscontrol.ActionAlertingReceiversList) {
					return true, nil
				}
				return false, nil
			},
		}
		return env
	}

	t.Run("contact point export", func(t *testing.T) {
		t.Run("are present, GET returns 200", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			response := sut.RouteGetContactPointsExport(&rc)

			require.Equal(t, 200, response.Status())
		})

		t.Run("accept header contains yaml, GET returns text yaml", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			rc.Req.Header.Add("Accept", "application/yaml")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
		})

		t.Run("accept header contains json, GET returns json", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			rc.Req.Header.Add("Accept", "application/json")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
		})

		t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			rc.Req.Header.Add("Accept", "application/json, application/yaml")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
		})

		t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			rc.Req.Form.Set("download", "true")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
		})

		t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			rc.Req.Form.Set("download", "false")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
		})

		t.Run("query param download not set, GET returns empty content disposition", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
		})

		t.Run("decrypt true without alert.provisioning.secrets:read permissions returns 403", func(t *testing.T) {
			recPermCheck := false
			env := createTestEnv(t, testConfig)
			env.ac = &recordingAccessControlFake{
				Callback: func(user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
					if strings.Contains(evaluator.String(), accesscontrol.ActionAlertingReceiversList) {
						return true, nil
					}
					if strings.Contains(evaluator.String(), accesscontrol.ActionAlertingProvisioningReadSecrets) {
						recPermCheck = true
					}
					return false, nil
				},
			}

			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			rc.Req.Form.Set("decrypt", "true")

			response := sut.RouteGetContactPointsExport(&rc)

			require.True(t, recPermCheck)
			require.Equal(t, 403, response.Status())
		})

		t.Run("decrypt true with admin returns 200", func(t *testing.T) {
			recPermCheck := false
			env := createTestEnv(t, testConfig)
			env.ac = &recordingAccessControlFake{
				Callback: func(user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
					if strings.Contains(evaluator.String(), accesscontrol.ActionAlertingProvisioningReadSecrets) {
						recPermCheck = true
					}
					return true, nil
				},
			}

			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			rc.Req.Form.Set("decrypt", "true")

			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.True(t, recPermCheck)
			require.Equal(t, 200, response.Status())
		})

		t.Run("json body content is as expected", func(t *testing.T) {
			expectedRedactedResponse := `{"apiVersion":1,"contactPoints":[{"orgId":1,"name":"grafana-default-email","receivers":[{"uid":"ad95bd8a-49ed-4adc-bf89-1b444fa1aa5b","type":"email","settings":{"addresses":"\u003cexample@email.com\u003e"},"disableResolveMessage":false}]},{"orgId":1,"name":"multiple integrations","receivers":[{"uid":"c2090fda-f824-4add-b545-5a4d5c2ef082","type":"prometheus-alertmanager","settings":{"basicAuthPassword":"[REDACTED]","basicAuthUser":"test","url":"http://localhost:9093"},"disableResolveMessage":true},{"uid":"c84539ec-f87e-4fc5-9a91-7a687d34bbd1","type":"discord","settings":{"avatar_url":"some avatar","url":"[REDACTED]","use_discord_username":true},"disableResolveMessage":false}]},{"orgId":1,"name":"pagerduty test","receivers":[{"uid":"b9bf06f8-bde2-4438-9d4a-bba0522dcd4d","type":"pagerduty","settings":{"client":"some client","integrationKey":"[REDACTED]","severity":"criticalish"},"disableResolveMessage":false}]},{"orgId":1,"name":"slack test","receivers":[{"uid":"cbfd0976-8228-4126-b672-4419f30a9e50","type":"slack","settings":{"text":"title body test","title":"title test","url":"[REDACTED]"},"disableResolveMessage":true}]}]}`
			t.Run("decrypt false", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json")
				rc.Req.Form.Set("decrypt", "false")

				response := sut.RouteGetContactPointsExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedRedactedResponse, string(response.Body()))
			})
			t.Run("decrypt missing", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json")

				response := sut.RouteGetContactPointsExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedRedactedResponse, string(response.Body()))
			})
			t.Run("decrypt true", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				env.ac.Callback = func(user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
					return true, nil
				}
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json")
				rc.Req.Form.Set("decrypt", "true")

				response := sut.RouteGetContactPointsExport(&rc)

				expectedResponse := `{"apiVersion":1,"contactPoints":[{"orgId":1,"name":"grafana-default-email","receivers":[{"uid":"ad95bd8a-49ed-4adc-bf89-1b444fa1aa5b","type":"email","settings":{"addresses":"\u003cexample@email.com\u003e"},"disableResolveMessage":false}]},{"orgId":1,"name":"multiple integrations","receivers":[{"uid":"c2090fda-f824-4add-b545-5a4d5c2ef082","type":"prometheus-alertmanager","settings":{"basicAuthPassword":"testpass","basicAuthUser":"test","url":"http://localhost:9093"},"disableResolveMessage":true},{"uid":"c84539ec-f87e-4fc5-9a91-7a687d34bbd1","type":"discord","settings":{"avatar_url":"some avatar","url":"some url","use_discord_username":true},"disableResolveMessage":false}]},{"orgId":1,"name":"pagerduty test","receivers":[{"uid":"b9bf06f8-bde2-4438-9d4a-bba0522dcd4d","type":"pagerduty","settings":{"client":"some client","integrationKey":"some key","severity":"criticalish"},"disableResolveMessage":false}]},{"orgId":1,"name":"slack test","receivers":[{"uid":"cbfd0976-8228-4126-b672-4419f30a9e50","type":"slack","settings":{"text":"title body test","title":"title test","url":"some secure slack webhook"},"disableResolveMessage":true}]}]}`
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
			t.Run("name filters response", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/json")
				rc.Req.Form.Set("name", "multiple integrations")

				response := sut.RouteGetContactPointsExport(&rc)

				expectedResponse := `{"apiVersion":1,"contactPoints":[{"orgId":1,"name":"multiple integrations","receivers":[{"uid":"c2090fda-f824-4add-b545-5a4d5c2ef082","type":"prometheus-alertmanager","settings":{"basicAuthPassword":"[REDACTED]","basicAuthUser":"test","url":"http://localhost:9093"},"disableResolveMessage":true},{"uid":"c84539ec-f87e-4fc5-9a91-7a687d34bbd1","type":"discord","settings":{"avatar_url":"some avatar","url":"[REDACTED]","use_discord_username":true},"disableResolveMessage":false}]}]}`
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
		})

		t.Run("yaml body content is as expected", func(t *testing.T) {
			expectedRedactedResponse := "apiVersion: 1\ncontactPoints:\n    - orgId: 1\n      name: grafana-default-email\n      receivers:\n        - uid: ad95bd8a-49ed-4adc-bf89-1b444fa1aa5b\n          type: email\n          settings:\n            addresses: <example@email.com>\n          disableResolveMessage: false\n    - orgId: 1\n      name: multiple integrations\n      receivers:\n        - uid: c2090fda-f824-4add-b545-5a4d5c2ef082\n          type: prometheus-alertmanager\n          settings:\n            basicAuthPassword: '[REDACTED]'\n            basicAuthUser: test\n            url: http://localhost:9093\n          disableResolveMessage: true\n        - uid: c84539ec-f87e-4fc5-9a91-7a687d34bbd1\n          type: discord\n          settings:\n            avatar_url: some avatar\n            url: '[REDACTED]'\n            use_discord_username: true\n          disableResolveMessage: false\n    - orgId: 1\n      name: pagerduty test\n      receivers:\n        - uid: b9bf06f8-bde2-4438-9d4a-bba0522dcd4d\n          type: pagerduty\n          settings:\n            client: some client\n            integrationKey: '[REDACTED]'\n            severity: criticalish\n          disableResolveMessage: false\n    - orgId: 1\n      name: slack test\n      receivers:\n        - uid: cbfd0976-8228-4126-b672-4419f30a9e50\n          type: slack\n          settings:\n            text: title body test\n            title: title test\n            url: '[REDACTED]'\n          disableResolveMessage: true\n"
			t.Run("decrypt false", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/yaml")
				rc.Req.Form.Set("decrypt", "false")

				response := sut.RouteGetContactPointsExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedRedactedResponse, string(response.Body()))
			})
			t.Run("decrypt missing", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/yaml")

				response := sut.RouteGetContactPointsExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedRedactedResponse, string(response.Body()))
			})
			t.Run("decrypt true", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				env.ac.Callback = func(user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
					return true, nil
				}
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/yaml")
				rc.Req.Form.Set("decrypt", "true")

				response := sut.RouteGetContactPointsExport(&rc)

				expectedResponse := "apiVersion: 1\ncontactPoints:\n    - orgId: 1\n      name: grafana-default-email\n      receivers:\n        - uid: ad95bd8a-49ed-4adc-bf89-1b444fa1aa5b\n          type: email\n          settings:\n            addresses: <example@email.com>\n          disableResolveMessage: false\n    - orgId: 1\n      name: multiple integrations\n      receivers:\n        - uid: c2090fda-f824-4add-b545-5a4d5c2ef082\n          type: prometheus-alertmanager\n          settings:\n            basicAuthPassword: testpass\n            basicAuthUser: test\n            url: http://localhost:9093\n          disableResolveMessage: true\n        - uid: c84539ec-f87e-4fc5-9a91-7a687d34bbd1\n          type: discord\n          settings:\n            avatar_url: some avatar\n            url: some url\n            use_discord_username: true\n          disableResolveMessage: false\n    - orgId: 1\n      name: pagerduty test\n      receivers:\n        - uid: b9bf06f8-bde2-4438-9d4a-bba0522dcd4d\n          type: pagerduty\n          settings:\n            client: some client\n            integrationKey: some key\n            severity: criticalish\n          disableResolveMessage: false\n    - orgId: 1\n      name: slack test\n      receivers:\n        - uid: cbfd0976-8228-4126-b672-4419f30a9e50\n          type: slack\n          settings:\n            text: title body test\n            title: title test\n            url: some secure slack webhook\n          disableResolveMessage: true\n"
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
			t.Run("name filters response", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Req.Header.Add("Accept", "application/yaml")
				rc.Req.Form.Set("name", "multiple integrations")

				response := sut.RouteGetContactPointsExport(&rc)

				expectedResponse := "apiVersion: 1\ncontactPoints:\n    - orgId: 1\n      name: multiple integrations\n      receivers:\n        - uid: c2090fda-f824-4add-b545-5a4d5c2ef082\n          type: prometheus-alertmanager\n          settings:\n            basicAuthPassword: '[REDACTED]'\n            basicAuthUser: test\n            url: http://localhost:9093\n          disableResolveMessage: true\n        - uid: c84539ec-f87e-4fc5-9a91-7a687d34bbd1\n          type: discord\n          settings:\n            avatar_url: some avatar\n            url: '[REDACTED]'\n            use_discord_username: true\n          disableResolveMessage: false\n"
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
		})
	})
}

func TestApiContactPointExportSnapshot(t *testing.T) {
	// This test should fail whenever the export of a contact point changes. If the change is expected, update
	// the corresponding test response file(s) in test-data/receiver-exports/*
	type testcase struct {
		name       string
		receiver   models.Receiver
		redacted   bool
		exportType string
	}
	runTestCase := func(t *testing.T, tc testcase) {
		postableReceiver, err := legacy_storage.ReceiverToPostableApiReceiver(&tc.receiver)
		require.NoError(t, err)
		postable := definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: postableReceiver.Name,
					},
				},
				Receivers: []*definitions.PostableApiReceiver{postableReceiver},
			},
		}

		amConfig, err := json.Marshal(postable)
		require.NoError(t, err)

		env := createTestEnv(t, string(amConfig))
		env.ac.Callback = func(user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
			return true, nil
		}
		sut := createProvisioningSrvSutFromEnv(t, &env)
		rc := createTestRequestCtx()

		switch tc.exportType {
		case "yaml":
			rc.Req.Header.Add("Accept", "application/yaml")
		case "json":
			rc.Req.Header.Add("Accept", "application/json")
		case "hcl":
			rc.Req.Form.Add("format", "hcl")
		default:
			t.Fatalf("unknown export type %q", tc.exportType)
		}

		if tc.redacted {
			rc.Req.Form.Set("decrypt", "false")
		} else {
			rc.Req.Form.Set("decrypt", "true")
		}

		response := sut.RouteGetContactPointsExport(&rc)
		require.Equalf(t, 200, response.Status(), "expected 200, got %d, body: %q", response.Status(), response.Body())

		actualBody := response.Body()
		if tc.exportType == "json" {
			// Indent the JSON for easier comparison.
			// This isn't strictly necessary, but it makes the test output more readable.
			out := new(bytes.Buffer)
			err = json.Indent(out, actualBody, "", " ")
			require.NoError(t, err)
			actualBody = out.Bytes()
		}

		p := path.Join("test-data", "receiver-exports", "redacted")
		if !tc.redacted {
			p = path.Join("test-data", "receiver-exports", "unredacted")
		}
		p = path.Join(p, fmt.Sprintf("%s.%s", tc.name, tc.exportType))

		// To update these files: os.WriteFile(path.Join(p), actualBody, 0644)

		exportRaw, err := receiverExportResponses.ReadFile(p)
		require.NoError(t, err)
		require.Equal(t, string(exportRaw), string(actualBody))
	}

	t.Run("contact point export for all known configs", func(t *testing.T) {
		allIntegrationsName := "all-integrations"
		for _, exportType := range []string{"yaml", "json", "hcl"} {
			t.Run(fmt.Sprintf("exportType=%s", exportType), func(t *testing.T) {
				for _, redacted := range []bool{true, false} {
					t.Run(fmt.Sprintf("redacted=%t", redacted), func(t *testing.T) {
						allIntegrations := make([]models.Integration, 0, len(alertingNotify.AllKnownConfigsForTesting))
						for integrationType := range alertingNotify.AllKnownConfigsForTesting {
							integration := models.IntegrationGen(
								models.IntegrationMuts.WithName(allIntegrationsName),
								models.IntegrationMuts.WithUID(fmt.Sprintf("%s-uid", integrationType)),
								models.IntegrationMuts.WithValidConfig(integrationType),
							)()
							integration.DisableResolveMessage = redacted
							allIntegrations = append(allIntegrations, integration)
						}
						receiver := models.ReceiverGen(models.ReceiverMuts.WithName(allIntegrationsName), models.ReceiverMuts.WithIntegrations(allIntegrations...))()
						runTestCase(t, testcase{
							name:       allIntegrationsName,
							receiver:   receiver,
							redacted:   redacted,
							exportType: exportType,
						})
					})
				}
			})
		}
	})
}

// testEnvironment binds together common dependencies for testing alerting APIs.
type testEnvironment struct {
	secrets          secrets.Service
	log              log.Logger
	store            store.DBstore
	folderService    folder.Service
	dashboardService dashboards.DashboardService
	configs          legacy_storage.AMConfigStore
	xact             provisioning.TransactionManager
	quotas           provisioning.QuotaChecker
	prov             provisioning.ProvisioningStore
	ac               *recordingAccessControlFake
	user             *user.SignedInUser
	rulesAuthz       *fakes.FakeRuleService
	features         featuremgmt.FeatureToggles
	nsValidator      provisioning.NotificationSettingsValidatorProvider
}

func createTestEnv(t *testing.T, testConfig string) testEnvironment {
	t.Helper()

	secretsService := secrets_fakes.NewFakeSecretsService()

	// Encrypt secure settings.
	c, err := notifier.Load([]byte(testConfig))
	require.NoError(t, err)
	err = notifier.EncryptReceiverConfigs(c.AlertmanagerConfig.Receivers, func(ctx context.Context, payload []byte) ([]byte, error) {
		return secretsService.Encrypt(ctx, payload, secrets.WithoutScope())
	})
	require.NoError(t, err)

	raw, err := json.Marshal(c)
	require.NoError(t, err)

	log := log.NewNopLogger()
	configs := &legacy_storage.MockAMConfigStore{}
	configs.EXPECT().
		GetsConfig(models.AlertConfiguration{
			AlertmanagerConfiguration: string(raw),
		})
	sqlStore, _ := db.InitTestDBWithCfg(t)

	quotas := &provisioning.MockQuotaChecker{}
	quotas.EXPECT().LimitOK()
	xact := &provisioning.NopTransactionManager{}
	prov := &provisioning.MockProvisioningStore{}
	prov.EXPECT().SaveSucceeds()
	prov.EXPECT().GetReturns(models.ProvenanceNone)

	dashboardService := dashboards.NewFakeDashboardService(t)
	dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(&dashboards.Dashboard{
		UID:   "folder-uid",
		Title: "Folder Title",
	}, nil).Maybe()
	dashboardService.On("GetDashboards", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardsQuery")).Return([]*dashboards.Dashboard{{
		UID:   "folder-uid",
		Title: "Folder Title",
	},
		{
			UID:   "folder-uid2",
			Title: "Folder Title2",
		}}, nil).Maybe()

	ac := &recordingAccessControlFake{}
	folderService := foldertest.NewFakeService()
	folder1 := &folder.Folder{
		UID:      "folder-uid",
		Title:    "Folder Title",
		Fullpath: "Folder Title",
		OrgID:    1,
	}
	folder2 := &folder.Folder{
		UID:       "folder-uid2",
		Title:     "Folder Title2",
		ParentUID: "folder-uid",
		Fullpath:  "Folder Title2",
		OrgID:     1,
	}
	folder3 := &folder.Folder{
		UID:       "folder-uid3",
		Title:     "Folder Title3",
		ParentUID: "folder-uid",
		Fullpath:  "Folder Title3",
		OrgID:     3,
	}
	folderService.SetFolders(map[string]*folder.Folder{
		"folder-uid":  folder1,
		"folder-uid2": folder2,
		"folder-uid3": folder3,
	})
	folderService.ExpectedFolders = []*folder.Folder{
		folder1,
		folder2,
		folder3,
	}
	// if not one of the two above, return ErrFolderNotFound
	folderService.ExpectedError = dashboards.ErrFolderNotFound
	store := store.DBstore{
		Logger:   log,
		SQLStore: sqlStore,
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval: time.Second * 10,
		},
		FolderService:  folderService,
		Bus:            bus.ProvideBus(tracing.InitializeTracerForTest()),
		FeatureToggles: featuremgmt.WithFeatures(),
	}
	user := &user.SignedInUser{
		OrgID: 1,
		/*
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionFoldersCreate: {}, dashboards.ActionFoldersRead: {dashboards.ScopeFoldersAll}},
			},
		*/
	}

	ruleAuthz := &fakes.FakeRuleService{}

	features := featuremgmt.WithFeatures()

	return testEnvironment{
		secrets:          secretsService,
		log:              log,
		configs:          configs,
		store:            store,
		folderService:    folderService,
		dashboardService: dashboardService,
		xact:             xact,
		prov:             prov,
		quotas:           quotas,
		ac:               ac,
		user:             user,
		rulesAuthz:       ruleAuthz,
		features:         features,
		nsValidator:      &provisioning.NotificationSettingsValidatorProviderFake{},
	}
}

func createProvisioningSrvSut(t *testing.T) ProvisioningSrv {
	t.Helper()

	env := createTestEnv(t, testConfig)
	return createProvisioningSrvSutFromEnv(t, &env)
}

func createProvisioningSrvSutFromEnv(t *testing.T, env *testEnvironment) ProvisioningSrv {
	t.Helper()
	tracer := tracing.InitializeTracerForTest()
	configStore := legacy_storage.NewAlertmanagerConfigStore(env.configs, notifier.NewExtraConfigsCrypto(env.secrets))
	receiverSvc := notifier.NewReceiverService(
		ac.NewReceiverAccess[*models.Receiver](env.ac, true),
		configStore,
		env.prov,
		env.store,
		env.secrets,
		env.xact,
		env.log,
		ngalertfakes.NewFakeReceiverPermissionsService(),
		tracer,
	)
	return ProvisioningSrv{
		log:                 env.log,
		policies:            newFakeNotificationPolicyService(),
		contactPointService: provisioning.NewContactPointService(configStore, env.secrets, env.prov, env.xact, receiverSvc, env.log, env.store, ngalertfakes.NewFakeReceiverPermissionsService()),
		templates:           provisioning.NewTemplateService(configStore, env.prov, env.xact, env.log),
		muteTimings:         provisioning.NewMuteTimingService(configStore, env.prov, env.xact, env.log, env.store),
		alertRules:          provisioning.NewAlertRuleService(env.store, env.prov, env.folderService, env.quotas, env.xact, 60, 10, 100, env.log, env.nsValidator, env.rulesAuthz),
		folderSvc:           env.folderService,
		featureManager:      env.features,
	}
}

func createTestRequestCtx() contextmodel.ReqContext {
	return contextmodel.ReqContext{
		Context: &web.Context{
			Req: &http.Request{
				Header: make(http.Header),
				Form:   make(url.Values),
			},
			Resp: web.NewResponseWriter("GET", httptest.NewRecorder()),
		},
		SignedInUser: &user.SignedInUser{
			OrgID: 1,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionFoldersRead: {dashboards.ScopeFoldersAll}},
			},
		},
		Logger: &logtest.Fake{},
	}
}

type fakeNotificationPolicyService struct {
	tree definitions.Route
	prov models.Provenance
}

func newFakeNotificationPolicyService() *fakeNotificationPolicyService {
	return &fakeNotificationPolicyService{
		tree: definitions.Route{
			Receiver: "some-receiver",
		},
		prov: models.ProvenanceNone,
	}
}

func createFakeNotificationPolicyService() *fakeNotificationPolicyService {
	seconds := model.Duration(time.Duration(30) * time.Second)
	minutes := model.Duration(time.Duration(5) * time.Minute)
	hours := model.Duration(time.Duration(1) * time.Hour)
	return &fakeNotificationPolicyService{
		tree: definitions.Route{
			Receiver:       "default-receiver",
			GroupByStr:     []string{"g1", "g2"},
			GroupWait:      &seconds,
			GroupInterval:  &minutes,
			RepeatInterval: &hours,
			Routes: []*definitions.Route{{
				Receiver:   "nested-receiver",
				GroupByStr: []string{"g3", "g4"},
				Matchers: prometheus.Matchers{
					{
						Name:  "a",
						Type:  labels.MatchEqual,
						Value: "b",
					},
				},
				ObjectMatchers:      definitions.ObjectMatchers{{Type: 0, Name: "foo", Value: "bar"}},
				MuteTimeIntervals:   []string{"interval"},
				ActiveTimeIntervals: []string{"active"},
				Continue:            true,
				GroupWait:           &minutes,
				GroupInterval:       &minutes,
				RepeatInterval:      &minutes,
			}},
		},
		prov: models.ProvenanceAPI,
	}
}

func (f *fakeNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, string, error) {
	if orgID != 1 {
		return definitions.Route{}, "", store.ErrNoAlertmanagerConfiguration
	}
	result := f.tree
	result.Provenance = definitions.Provenance(f.prov)
	return result, "", nil
}

func (f *fakeNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance, version string) (definitions.Route, string, error) {
	if orgID != 1 {
		return definitions.Route{}, "", store.ErrNoAlertmanagerConfiguration
	}
	f.tree = tree
	f.prov = p
	return tree, "some", nil
}

func (f *fakeNotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64, provenance models.Provenance) (definitions.Route, error) {
	f.tree = definitions.Route{} // TODO
	return f.tree, nil
}

type fakeFailingNotificationPolicyService struct{}

func (f *fakeFailingNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, string, error) {
	return definitions.Route{}, "", fmt.Errorf("something went wrong")
}

func (f *fakeFailingNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance, version string) (definitions.Route, string, error) {
	return definitions.Route{}, "", fmt.Errorf("something went wrong")
}

func (f *fakeFailingNotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64, provenance models.Provenance) (definitions.Route, error) {
	return definitions.Route{}, fmt.Errorf("something went wrong")
}

type fakeRejectingNotificationPolicyService struct{}

type fakeRejectingNotificationSettingsValidatorProvider struct{}

func (f *fakeRejectingNotificationSettingsValidatorProvider) Validator(ctx context.Context, orgID int64) (notifier.NotificationSettingsValidator, error) {
	return notifier.RejectingValidation{}, nil
}

func (f *fakeRejectingNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, string, error) {
	return definitions.Route{}, "", nil
}

func (f *fakeRejectingNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance, version string) (definitions.Route, string, error) {
	return definitions.Route{}, "", fmt.Errorf("%w: invalid policy tree", provisioning.ErrValidation)
}

func (f *fakeRejectingNotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64, provenance models.Provenance) (definitions.Route, error) {
	return definitions.Route{}, nil
}

func createInvalidContactPoint() definitions.EmbeddedContactPoint {
	settings, _ := simplejson.NewJson([]byte(`{}`))
	return definitions.EmbeddedContactPoint{
		Name:     "test-contact-point",
		Type:     "slack",
		Settings: settings,
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

func createInvalidAlertRule() definitions.ProvisionedAlertRule {
	return definitions.ProvisionedAlertRule{}
}

func createInvalidAlertRuleGroup() definitions.AlertRuleGroup {
	return definitions.AlertRuleGroup{
		Title:    "invalid",
		Interval: 10,
		Rules:    []definitions.ProvisionedAlertRule{{}},
	}
}

func createTestAlertRuleGroup(orgID int64) definitions.AlertRuleGroup {
	return definitions.AlertRuleGroup{
		Title:    "test rule group",
		Interval: 60,
		Rules: []definitions.ProvisionedAlertRule{
			createTestAlertRule("test-alert-rule", orgID),
			createTestAlertRule("test-alert-rule-2", orgID),
			createTestRecordingRule("test-recording-rule", orgID),
		},
	}
}

func createTestAlertRuleWithFolderAndGroup(title string, orgID int64, folderUid string, group string) definitions.ProvisionedAlertRule {
	rule := createTestAlertRule(title, orgID)
	rule.FolderUID = folderUid
	rule.RuleGroup = group
	return rule
}

func createTestAlertRule(title string, orgID int64) definitions.ProvisionedAlertRule {
	return definitions.ProvisionedAlertRule{
		UID:       title,
		OrgID:     orgID,
		Title:     title,
		Condition: "A",
		Data: []definitions.AlertQuery{
			{
				RefID: "A",
				Model: json.RawMessage(testModel),
				RelativeTimeRange: definitions.RelativeTimeRange{
					From: definitions.Duration(60 * time.Second),
					To:   definitions.Duration(0),
				},
			},
		},
		RuleGroup:    "my-cool-group",
		FolderUID:    "folder-uid",
		For:          model.Duration(60),
		NoDataState:  definitions.OK,
		ExecErrState: definitions.OkErrState,
		NotificationSettings: &definitions.AlertRuleNotificationSettings{
			Receiver:            "Test-Receiver",
			GroupBy:             []string{"alertname", "grafana_folder", "test"},
			GroupWait:           util.Pointer(model.Duration(1 * time.Second)),
			GroupInterval:       util.Pointer(model.Duration(5 * time.Second)),
			RepeatInterval:      util.Pointer(model.Duration(5 * time.Minute)),
			MuteTimeIntervals:   []string{"test-mute"},
			ActiveTimeIntervals: []string{"test-active"},
		},
	}
}

func createTestRecordingRule(title string, orgID int64) definitions.ProvisionedAlertRule {
	return definitions.ProvisionedAlertRule{
		UID:       title,
		OrgID:     orgID,
		Title:     title,
		Condition: "A",
		Data: []definitions.AlertQuery{
			{
				RefID: "A",
				Model: json.RawMessage(testModel),
				RelativeTimeRange: definitions.RelativeTimeRange{
					From: definitions.Duration(60 * time.Second),
					To:   definitions.Duration(0),
				},
			},
		},
		RuleGroup: "my-cool-group",
		FolderUID: "folder-uid",
		For:       model.Duration(60),
		Record: &definitions.Record{
			Metric: "test_record",
			From:   "A",
		},
	}
}

func insertRule(t *testing.T, srv ProvisioningSrv, rule definitions.ProvisionedAlertRule) {
	insertRuleInOrg(t, srv, rule, 1)
}

func insertRuleInOrg(t *testing.T, srv ProvisioningSrv, rule definitions.ProvisionedAlertRule, orgID int64) {
	t.Helper()

	rc := createTestRequestCtx()
	rc.OrgID = orgID
	resp := srv.RoutePostAlertRule(&rc, rule)
	require.Equal(t, 201, resp.Status())
}

func deserializeRuleGroup(t *testing.T, data []byte) definitions.AlertRuleGroup {
	t.Helper()

	var rule definitions.AlertRuleGroup
	err := json.Unmarshal(data, &rule)
	require.NoError(t, err)
	return rule
}

func deserializeRule(t *testing.T, data []byte) definitions.ProvisionedAlertRule {
	t.Helper()

	var rule definitions.ProvisionedAlertRule
	err := json.Unmarshal(data, &rule)
	require.NoError(t, err)
	return rule
}

var testModel = `
{
  "conditions": [
    {
      "evaluator": {
        "params": [
          3
        ],
        "type": "gt"
      },
      "operator": {
        "type": "and"
      },
      "query": {
        "params": [
          "A"
        ]
      },
      "reducer": {
        "type": "last"
      },
      "type": "query"
    }
  ],
  "datasource": {
    "type": "__expr__",
    "uid": "__expr__"
  },
  "expression": "1==0",
  "intervalMs": 1000,
  "maxDataPoints": 43200,
  "refId": "A",
  "type": "math"
}
`

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
				"uid": "email-uid",
				"name": "email receiver",
				"type": "email",
				"settings": {
					"addresses": "<example@email.com>"
				}
			}]
		}],
		"mute_time_intervals": [{
			"name": "interval-1",
			"time_intervals": []
		}, {
                "name": "interval-2",
                "time_intervals": [
                    {
                        "times": [
                            {
                                "start_time": "10:00",
                                "end_time": "12:00"
                            }
                        ],
                        "weekdays": [
                            "monday",
                            "wednesday",
                            "friday"
                        ],
                        "days_of_month": [
                            "1",
                            "14:16",
                            "20"
                        ],
                        "months": [
                            "1:3",
                            "7",
                            "12"
                        ],
                        "years": [
                            "2023:2025"
                        ],
                        "location": "America/New_York"
                    }
                ]
            }]
	}
}
`

var testContactPointConfig = `
{
	"template_files": {
		"a": "template"
	},
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"receivers": [
   {
      "name":"grafana-default-email",
      "grafana_managed_receiver_configs":[
         {
            "uid":"ad95bd8a-49ed-4adc-bf89-1b444fa1aa5b",
            "name":"grafana-default-email",
            "type":"email",
            "disableResolveMessage":false,
            "settings":{
               "addresses":"<example@email.com>"
            },
            "secureSettings":{}
         }
      ]
   },
   {
      "name":"multiple integrations",
      "grafana_managed_receiver_configs":[
         {
            "uid":"c2090fda-f824-4add-b545-5a4d5c2ef082",
            "name":"multiple integrations",
            "type":"prometheus-alertmanager",
            "disableResolveMessage":true,
            "settings":{
               "basicAuthUser":"test",
               "url":"http://localhost:9093"
            },
            "secureSettings":{
               "basicAuthPassword":"testpass"
            }
         },
         {
            "uid":"c84539ec-f87e-4fc5-9a91-7a687d34bbd1",
            "name":"multiple integrations",
            "type":"discord",
            "disableResolveMessage":false,
            "settings":{
               "avatar_url":"some avatar",
               "use_discord_username":true
            },
            "secureSettings":{
     		  "url":"some url"
            }
         }
      ]
   },
   {
      "name":"pagerduty test",
      "grafana_managed_receiver_configs":[
         {
            "uid":"b9bf06f8-bde2-4438-9d4a-bba0522dcd4d",
            "name":"pagerduty test",
            "type":"pagerduty",
            "disableResolveMessage":false,
            "settings":{
               "client":"some client",
               "severity":"criticalish"
            },
            "secureSettings":{
               "integrationKey":"some key"
            }
         }
      ]
   },
   {
      "name":"slack test",
      "grafana_managed_receiver_configs":[
         {
            "uid":"cbfd0976-8228-4126-b672-4419f30a9e50",
            "name":"slack test",
            "type":"slack",
            "disableResolveMessage":true,
            "settings":{
               "text":"title body test",
               "title":"title test"
            },
            "secureSettings":{
               "url":"some secure slack webhook"
            }
         }
      ]
   }
]
	}
}
`
