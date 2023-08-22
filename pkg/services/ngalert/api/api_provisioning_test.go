package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	prometheus "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	secrets_fakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
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
				expBody := `{"error":"invalid object specification: invalid policy tree","message":"invalid object specification: invalid policy tree"}`
				require.Equal(t, expBody, string(response.Body()))
			})
		})

		t.Run("when org has no AM config", func(t *testing.T) {
			t.Run("GET returns 404", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rc.SignedInUser.OrgID = 2

				response := sut.RouteGetPolicyTree(&rc)

				require.Equal(t, 404, response.Status())
			})

			t.Run("POST returns 404", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rc.SignedInUser.OrgID = 2

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
				require.Contains(t, string(response.Body()), "something went wrong")
			})

			t.Run("PUT returns 500", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = &fakeFailingNotificationPolicyService{}
				rc := createTestRequestCtx()
				tree := definitions.Route{}

				response := sut.RoutePutPolicyTree(&rc, tree)

				require.Equal(t, 500, response.Status())
				require.NotEmpty(t, response.Body())
				require.Contains(t, string(response.Body()), "something went wrong")
			})

			t.Run("DELETE returns 500", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = &fakeFailingNotificationPolicyService{}
				rc := createTestRequestCtx()

				response := sut.RouteResetPolicyTree(&rc)

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
		})

		t.Run("exist in non-default orgs", func(t *testing.T) {
			t.Run("POST sets expected fields with no provenance", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				rc.Req.Header = map[string][]string{"X-Disable-Provenance": {"true"}}
				rc.OrgID = 3
				rule := createTestAlertRule("rule", 1)

				response := sut.RoutePostAlertRule(&rc, rule)

				require.Equal(t, 201, response.Status())
				created := deserializeRule(t, response.Body())
				require.Equal(t, int64(3), created.OrgID)
				require.Equal(t, definitions.Provenance(models.ProvenanceNone), created.Provenance)
			})

			t.Run("PUT sets expected fields with no provenance", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				uid := t.Name()
				rule := createTestAlertRule("rule", 1)
				rule.UID = uid
				insertRuleInOrg(t, sut, rule, 3)
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
	})

	t.Run("alert rule groups", func(t *testing.T) {
		t.Run("are present, GET returns 200", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			insertRule(t, sut, createTestAlertRule("rule", 1))

			response := sut.RouteGetAlertRuleGroup(&rc, "folder-uid", "my-cool-group")

			require.Equal(t, 200, response.Status())
		})

		t.Run("are missing, GET returns 404", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()
			insertRule(t, sut, createTestAlertRule("rule", 1))

			response := sut.RouteGetAlertRuleGroup(&rc, "folder-uid", "does not exist")

			require.Equal(t, 404, response.Status())
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

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query format contains yaml, GET returns text yaml", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Form.Set("format", "yaml")

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query format contains unknown value, GET returns text yaml", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Form.Set("format", "foo")

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Header.Add("Accept", "application/json, application/yaml")
				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Form.Set("download", "true")
				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
			})

			t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Form.Set("download", "false")
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
				insertRule(t, sut, createTestAlertRule("rule1", 1))
				insertRule(t, sut, createTestAlertRule("rule2", 1))

				expectedResponse := "apiVersion: 1\ngroups:\n    - orgId: 1\n      name: my-cool-group\n      folder" +
					": Folder Title\n      interval: 1m\n      rules:\n        - uid: rule1\n          title: rule1\n" +
					"          condition: A\n          data:\n            - refId: A\n              datasourceUid" +
					": \"\"\n              model:\n                conditions:\n                    - evaluator:\n" +
					"                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n        - uid: rule2\n          title: rule2\n          condition: A\n          data:\n            - refId: A\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n"

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("json body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))
				insertRule(t, sut, createTestAlertRule("rule2", 1))

				rc.Context.Req.Header.Add("Accept", "application/json")
				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"my-cool-group","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false},{"uid":"rule2","title":"rule2","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false}]}]}`

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("yaml body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))
				insertRule(t, sut, createTestAlertRule("rule2", 1))

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				expectedResponse := "apiVersion: 1\ngroups:\n    - orgId: 1\n      name: my-cool-group\n      folder" +
					": Folder Title\n      interval: 1m\n      rules:\n        - uid: rule1\n          title: rule1\n" +
					"          condition: A\n          data:\n            - refId: A\n              datasourceUid" +
					": \"\"\n              model:\n                conditions:\n                    - evaluator:\n" +
					"                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n        - uid: rule2\n          title: rule2\n          condition: A\n          data:\n            - refId: A\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n"

				response := sut.RouteGetAlertRuleGroupExport(&rc, "folder-uid", "my-cool-group")

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
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

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Context.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Context.Req.Header.Add("Accept", "application/json, application/yaml")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Context.Req.Form.Set("download", "true")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
			})

			t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Context.Req.Form.Set("download", "false")
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

				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"my-cool-group","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false}]}]}`

				rc.Context.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetAlertRuleExport(&rc, "rule1")

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("yaml body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule1", 1))

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				expectedResponse := "apiVersion: 1\ngroups:\n    - orgId: 1\n      name: my-cool-group\n      folder: Folder Title\n      interval: 1m\n      rules:\n        - uid: rule1\n          title: rule1\n          condition: A\n          data:\n            - refId: A\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n"

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

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Header.Add("Accept", "application/json, application/yaml")
				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Form.Set("download", "true")
				response := sut.RouteGetAlertRulesExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
			})

			t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRule("rule", 1))

				rc.Context.Req.Form.Set("download", "false")
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
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule1", 1, "folder-uid", "groupa"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule2", 1, "folder-uid", "groupb"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule3", 1, "folder-uid2", "groupb"))

				rc.Context.Req.Header.Add("Accept", "application/json")
				expectedResponse := `{"apiVersion":1,"groups":[{"orgId":1,"name":"groupa","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule1","title":"rule1","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false}]},{"orgId":1,"name":"groupb","folder":"Folder Title","interval":"1m","rules":[{"uid":"rule2","title":"rule2","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false}]},{"orgId":1,"name":"groupb","folder":"Folder Title2","interval":"1m","rules":[{"uid":"rule3","title":"rule3","condition":"A","data":[{"refId":"A","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"","model":{"conditions":[{"evaluator":{"params":[3],"type":"gt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"last"},"type":"query"}],"datasource":{"type":"__expr__","uid":"__expr__"},"expression":"1==0","intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"math"}}],"noDataState":"OK","execErrState":"OK","for":"0s","isPaused":false}]}]}`

				response := sut.RouteGetAlertRulesExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("yaml body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule1", 1, "folder-uid", "groupa"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule2", 1, "folder-uid", "groupb"))
				insertRule(t, sut, createTestAlertRuleWithFolderAndGroup("rule3", 1, "folder-uid2", "groupb"))

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				expectedResponse := "apiVersion: 1\ngroups:\n    - orgId: 1\n      name: groupa\n      folder: Folder Title\n      interval: 1m\n      rules:\n        - uid: rule1\n          title: rule1\n          condition: A\n          data:\n            - refId: A\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n    - orgId: 1\n      name: groupb\n      folder: Folder Title\n      interval: 1m\n      rules:\n        - uid: rule2\n          title: rule2\n          condition: A\n          data:\n            - refId: A\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n    - orgId: 1\n      name: groupb\n      folder: Folder Title2\n      interval: 1m\n      rules:\n        - uid: rule3\n          title: rule3\n          condition: A\n          data:\n            - refId: A\n              datasourceUid: \"\"\n              model:\n                conditions:\n                    - evaluator:\n                        params:\n                            - 3\n                        type: gt\n                      operator:\n                        type: and\n                      query:\n                        params:\n                            - A\n                      reducer:\n                        type: last\n                      type: query\n                datasource:\n                    type: __expr__\n                    uid: __expr__\n                expression: 1==0\n                intervalMs: 1000\n                maxDataPoints: 43200\n                refId: A\n                type: math\n          noDataState: OK\n          execErrState: OK\n          for: 0s\n          isPaused: false\n"

				response := sut.RouteGetAlertRulesExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
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

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Context.Req.Header.Add("Accept", "application/json")
				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Context.Req.Header.Add("Accept", "application/json, application/yaml")
				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
			})

			t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Context.Req.Form.Set("download", "true")
				response := sut.RouteGetPolicyTreeExport(&rc)
				response.WriteTo(&rc)

				require.Equal(t, 200, response.Status())
				require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
			})

			t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				rc := createTestRequestCtx()

				rc.Context.Req.Form.Set("download", "false")
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

				rc.Context.Req.Header.Add("Accept", "application/json")
				expectedResponse := `{"apiVersion":1,"policies":[{"orgId":1,"Policy":{"receiver":"default-receiver","group_by":["g1","g2"],"routes":[{"receiver":"nested-receiver","group_by":["g3","g4"],"matchers":["a=\"b\""],"object_matchers":[["foo","=","bar"]],"mute_time_intervals":["interval"],"continue":true,"group_wait":"5m","group_interval":"5m","repeat_interval":"5m"}],"group_wait":"30s","group_interval":"5m","repeat_interval":"1h"}}]}`

				response := sut.RouteGetPolicyTreeExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})

			t.Run("yaml body content is as expected", func(t *testing.T) {
				sut := createProvisioningSrvSut(t)
				sut.policies = createFakeNotificationPolicyService()
				rc := createTestRequestCtx()

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				expectedResponse := "apiVersion: 1\npolicies:\n    - orgId: 1\n      receiver: default-receiver\n      group_by:\n        - g1\n        - g2\n      routes:\n        - receiver: nested-receiver\n          group_by:\n            - g3\n            - g4\n          matchers:\n            - a=\"b\"\n          object_matchers:\n            - - foo\n              - =\n              - bar\n          mute_time_intervals:\n            - interval\n          continue: true\n          group_wait: 5m\n          group_interval: 5m\n          repeat_interval: 5m\n      group_wait: 30s\n      group_interval: 5m\n      repeat_interval: 1h\n"

				response := sut.RouteGetPolicyTreeExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
		})
	})
}

func TestProvisioningApiContactPointExport(t *testing.T) {
	t.Run("contact point export", func(t *testing.T) {
		t.Run("are present, GET returns 200", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()

			response := sut.RouteGetContactPointsExport(&rc)

			require.Equal(t, 200, response.Status())
		})

		t.Run("accept header contains yaml, GET returns text yaml", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()

			rc.Context.Req.Header.Add("Accept", "application/yaml")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "text/yaml", rc.Context.Resp.Header().Get("Content-Type"))
		})

		t.Run("accept header contains json, GET returns json", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()

			rc.Context.Req.Header.Add("Accept", "application/json")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
		})

		t.Run("accept header contains json and yaml, GET returns json", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()

			rc.Context.Req.Header.Add("Accept", "application/json, application/yaml")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "application/json", rc.Context.Resp.Header().Get("Content-Type"))
		})

		t.Run("query param download=true, GET returns content disposition attachment", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()

			rc.Context.Req.Form.Set("download", "true")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Contains(t, rc.Context.Resp.Header().Get("Content-Disposition"), "attachment")
		})

		t.Run("query param download=false, GET returns empty content disposition", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()

			rc.Context.Req.Form.Set("download", "false")
			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
		})

		t.Run("query param download not set, GET returns empty content disposition", func(t *testing.T) {
			sut := createProvisioningSrvSut(t)
			rc := createTestRequestCtx()

			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Equal(t, "", rc.Context.Resp.Header().Get("Content-Disposition"))
		})

		t.Run("decrypt true without alert.provisioning.secrets:read permissions returns 403", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			env.ac = &recordingAccessControlFake{
				Callback: func(user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
					return false, nil
				},
			}

			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			rc.Context.Req.Form.Set("decrypt", "true")

			response := sut.RouteGetContactPointsExport(&rc)

			require.Equal(t, 403, response.Status())
			require.Len(t, env.ac.EvaluateRecordings, 1)
			require.Equal(t, accesscontrol.ActionAlertingProvisioningReadSecrets, env.ac.EvaluateRecordings[0].Evaluator.String())
		})

		t.Run("decrypt true with admin returns 200", func(t *testing.T) {
			env := createTestEnv(t, testConfig)
			env.ac = &recordingAccessControlFake{
				Callback: func(user *user.SignedInUser, evaluator accesscontrol.Evaluator) (bool, error) {
					require.Equal(t, accesscontrol.ActionAlertingProvisioningReadSecrets, evaluator.String())
					return true, nil
				},
			}

			sut := createProvisioningSrvSutFromEnv(t, &env)
			rc := createTestRequestCtx()

			rc.Context.Req.Form.Set("decrypt", "true")

			response := sut.RouteGetContactPointsExport(&rc)
			response.WriteTo(&rc)

			require.Equal(t, 200, response.Status())
			require.Len(t, env.ac.EvaluateRecordings, 1)
			require.Equal(t, accesscontrol.ActionAlertingProvisioningReadSecrets, env.ac.EvaluateRecordings[0].Evaluator.String())
		})

		t.Run("json body content is as expected", func(t *testing.T) {
			expectedRedactedResponse := `{"apiVersion":1,"contactPoints":[{"orgId":1,"name":"grafana-default-email","receivers":[{"uid":"ad95bd8a-49ed-4adc-bf89-1b444fa1aa5b","type":"email","settings":{"addresses":"\u003cexample@email.com\u003e"},"disableResolveMessage":false}]},{"orgId":1,"name":"multiple integrations","receivers":[{"uid":"c2090fda-f824-4add-b545-5a4d5c2ef082","type":"prometheus-alertmanager","settings":{"basicAuthPassword":"[REDACTED]","basicAuthUser":"test","url":"http://localhost:9093"},"disableResolveMessage":true},{"uid":"c84539ec-f87e-4fc5-9a91-7a687d34bbd1","type":"discord","settings":{"avatar_url":"some avatar","url":"some url","use_discord_username":true},"disableResolveMessage":false}]},{"orgId":1,"name":"pagerduty test","receivers":[{"uid":"b9bf06f8-bde2-4438-9d4a-bba0522dcd4d","type":"pagerduty","settings":{"client":"some client","integrationKey":"[REDACTED]","severity":"criticalish"},"disableResolveMessage":false}]},{"orgId":1,"name":"slack test","receivers":[{"uid":"cbfd0976-8228-4126-b672-4419f30a9e50","type":"slack","settings":{"text":"title body test","title":"title test","url":"[REDACTED]"},"disableResolveMessage":true}]}]}`
			t.Run("decrypt false", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Context.Req.Header.Add("Accept", "application/json")
				rc.Context.Req.Form.Set("decrypt", "false")

				response := sut.RouteGetContactPointsExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedRedactedResponse, string(response.Body()))
			})
			t.Run("decrypt missing", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Context.Req.Header.Add("Accept", "application/json")

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

				rc.Context.Req.Header.Add("Accept", "application/json")
				rc.Context.Req.Form.Set("decrypt", "true")

				response := sut.RouteGetContactPointsExport(&rc)

				expectedResponse := `{"apiVersion":1,"contactPoints":[{"orgId":1,"name":"grafana-default-email","receivers":[{"uid":"ad95bd8a-49ed-4adc-bf89-1b444fa1aa5b","type":"email","settings":{"addresses":"\u003cexample@email.com\u003e"},"disableResolveMessage":false}]},{"orgId":1,"name":"multiple integrations","receivers":[{"uid":"c2090fda-f824-4add-b545-5a4d5c2ef082","type":"prometheus-alertmanager","settings":{"basicAuthPassword":"testpass","basicAuthUser":"test","url":"http://localhost:9093"},"disableResolveMessage":true},{"uid":"c84539ec-f87e-4fc5-9a91-7a687d34bbd1","type":"discord","settings":{"avatar_url":"some avatar","url":"some url","use_discord_username":true},"disableResolveMessage":false}]},{"orgId":1,"name":"pagerduty test","receivers":[{"uid":"b9bf06f8-bde2-4438-9d4a-bba0522dcd4d","type":"pagerduty","settings":{"client":"some client","integrationKey":"some key","severity":"criticalish"},"disableResolveMessage":false}]},{"orgId":1,"name":"slack test","receivers":[{"uid":"cbfd0976-8228-4126-b672-4419f30a9e50","type":"slack","settings":{"text":"title body test","title":"title test","url":"some secure slack webhook"},"disableResolveMessage":true}]}]}`
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
			t.Run("name filters response", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Context.Req.Header.Add("Accept", "application/json")
				rc.Context.Req.Form.Set("name", "multiple integrations")

				response := sut.RouteGetContactPointsExport(&rc)

				expectedResponse := `{"apiVersion":1,"contactPoints":[{"orgId":1,"name":"multiple integrations","receivers":[{"uid":"c2090fda-f824-4add-b545-5a4d5c2ef082","type":"prometheus-alertmanager","settings":{"basicAuthPassword":"[REDACTED]","basicAuthUser":"test","url":"http://localhost:9093"},"disableResolveMessage":true},{"uid":"c84539ec-f87e-4fc5-9a91-7a687d34bbd1","type":"discord","settings":{"avatar_url":"some avatar","url":"some url","use_discord_username":true},"disableResolveMessage":false}]}]}`
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
		})

		t.Run("yaml body content is as expected", func(t *testing.T) {
			expectedRedactedResponse := "apiVersion: 1\ncontactPoints:\n    - orgId: 1\n      name: grafana-default-email\n      receivers:\n        - uid: ad95bd8a-49ed-4adc-bf89-1b444fa1aa5b\n          type: email\n          settings:\n            addresses: <example@email.com>\n          disableResolveMessage: false\n    - orgId: 1\n      name: multiple integrations\n      receivers:\n        - uid: c2090fda-f824-4add-b545-5a4d5c2ef082\n          type: prometheus-alertmanager\n          settings:\n            basicAuthPassword: '[REDACTED]'\n            basicAuthUser: test\n            url: http://localhost:9093\n          disableResolveMessage: true\n        - uid: c84539ec-f87e-4fc5-9a91-7a687d34bbd1\n          type: discord\n          settings:\n            avatar_url: some avatar\n            url: some url\n            use_discord_username: true\n          disableResolveMessage: false\n    - orgId: 1\n      name: pagerduty test\n      receivers:\n        - uid: b9bf06f8-bde2-4438-9d4a-bba0522dcd4d\n          type: pagerduty\n          settings:\n            client: some client\n            integrationKey: '[REDACTED]'\n            severity: criticalish\n          disableResolveMessage: false\n    - orgId: 1\n      name: slack test\n      receivers:\n        - uid: cbfd0976-8228-4126-b672-4419f30a9e50\n          type: slack\n          settings:\n            text: title body test\n            title: title test\n            url: '[REDACTED]'\n          disableResolveMessage: true\n"
			t.Run("decrypt false", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				rc.Context.Req.Form.Set("decrypt", "false")

				response := sut.RouteGetContactPointsExport(&rc)

				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedRedactedResponse, string(response.Body()))
			})
			t.Run("decrypt missing", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Context.Req.Header.Add("Accept", "application/yaml")

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

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				rc.Context.Req.Form.Set("decrypt", "true")

				response := sut.RouteGetContactPointsExport(&rc)

				expectedResponse := "apiVersion: 1\ncontactPoints:\n    - orgId: 1\n      name: grafana-default-email\n      receivers:\n        - uid: ad95bd8a-49ed-4adc-bf89-1b444fa1aa5b\n          type: email\n          settings:\n            addresses: <example@email.com>\n          disableResolveMessage: false\n    - orgId: 1\n      name: multiple integrations\n      receivers:\n        - uid: c2090fda-f824-4add-b545-5a4d5c2ef082\n          type: prometheus-alertmanager\n          settings:\n            basicAuthPassword: testpass\n            basicAuthUser: test\n            url: http://localhost:9093\n          disableResolveMessage: true\n        - uid: c84539ec-f87e-4fc5-9a91-7a687d34bbd1\n          type: discord\n          settings:\n            avatar_url: some avatar\n            url: some url\n            use_discord_username: true\n          disableResolveMessage: false\n    - orgId: 1\n      name: pagerduty test\n      receivers:\n        - uid: b9bf06f8-bde2-4438-9d4a-bba0522dcd4d\n          type: pagerduty\n          settings:\n            client: some client\n            integrationKey: some key\n            severity: criticalish\n          disableResolveMessage: false\n    - orgId: 1\n      name: slack test\n      receivers:\n        - uid: cbfd0976-8228-4126-b672-4419f30a9e50\n          type: slack\n          settings:\n            text: title body test\n            title: title test\n            url: some secure slack webhook\n          disableResolveMessage: true\n"
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
			t.Run("name filters response", func(t *testing.T) {
				env := createTestEnv(t, testContactPointConfig)
				sut := createProvisioningSrvSutFromEnv(t, &env)
				rc := createTestRequestCtx()

				rc.Context.Req.Header.Add("Accept", "application/yaml")
				rc.Context.Req.Form.Set("name", "multiple integrations")

				response := sut.RouteGetContactPointsExport(&rc)

				expectedResponse := "apiVersion: 1\ncontactPoints:\n    - orgId: 1\n      name: multiple integrations\n      receivers:\n        - uid: c2090fda-f824-4add-b545-5a4d5c2ef082\n          type: prometheus-alertmanager\n          settings:\n            basicAuthPassword: '[REDACTED]'\n            basicAuthUser: test\n            url: http://localhost:9093\n          disableResolveMessage: true\n        - uid: c84539ec-f87e-4fc5-9a91-7a687d34bbd1\n          type: discord\n          settings:\n            avatar_url: some avatar\n            url: some url\n            use_discord_username: true\n          disableResolveMessage: false\n"
				require.Equal(t, 200, response.Status())
				require.Equal(t, expectedResponse, string(response.Body()))
			})
		})
	})
}

// testEnvironment binds together common dependencies for testing alerting APIs.
type testEnvironment struct {
	secrets          secrets.Service
	log              log.Logger
	store            store.DBstore
	dashboardService dashboards.DashboardService
	configs          provisioning.AMConfigStore
	xact             provisioning.TransactionManager
	quotas           provisioning.QuotaChecker
	prov             provisioning.ProvisioningStore
	ac               *recordingAccessControlFake
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
	configs := &provisioning.MockAMConfigStore{}
	configs.EXPECT().
		GetsConfig(models.AlertConfiguration{
			AlertmanagerConfiguration: string(raw),
		})
	sqlStore := db.InitTestDB(t)
	store := store.DBstore{
		SQLStore: sqlStore,
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval: time.Second * 10,
		},
	}
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

	return testEnvironment{
		secrets:          secretsService,
		log:              log,
		configs:          configs,
		store:            store,
		dashboardService: dashboardService,
		xact:             xact,
		prov:             prov,
		quotas:           quotas,
		ac:               ac,
	}
}

func createProvisioningSrvSut(t *testing.T) ProvisioningSrv {
	t.Helper()

	env := createTestEnv(t, testConfig)
	return createProvisioningSrvSutFromEnv(t, &env)
}

func createProvisioningSrvSutFromEnv(t *testing.T, env *testEnvironment) ProvisioningSrv {
	t.Helper()

	return ProvisioningSrv{
		log:                 env.log,
		policies:            newFakeNotificationPolicyService(),
		contactPointService: provisioning.NewContactPointService(env.configs, env.secrets, env.prov, env.xact, env.log, env.ac),
		templates:           provisioning.NewTemplateService(env.configs, env.prov, env.xact, env.log),
		muteTimings:         provisioning.NewMuteTimingService(env.configs, env.prov, env.xact, env.log),
		alertRules:          provisioning.NewAlertRuleService(env.store, env.prov, env.dashboardService, env.quotas, env.xact, 60, 10, env.log),
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
				ObjectMatchers:    definitions.ObjectMatchers{{Type: 0, Name: "foo", Value: "bar"}},
				MuteTimeIntervals: []string{"interval"},
				Continue:          true,
				GroupWait:         &minutes,
				GroupInterval:     &minutes,
				RepeatInterval:    &minutes,
			}},
		},
		prov: models.ProvenanceAPI,
	}
}

func (f *fakeNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	if orgID != 1 {
		return definitions.Route{}, store.ErrNoAlertmanagerConfiguration
	}
	result := f.tree
	result.Provenance = definitions.Provenance(f.prov)
	return result, nil
}

func (f *fakeNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance) error {
	if orgID != 1 {
		return store.ErrNoAlertmanagerConfiguration
	}
	f.tree = tree
	f.prov = p
	return nil
}

func (f *fakeNotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	f.tree = definitions.Route{} // TODO
	return f.tree, nil
}

type fakeFailingNotificationPolicyService struct{}

func (f *fakeFailingNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	return definitions.Route{}, fmt.Errorf("something went wrong")
}

func (f *fakeFailingNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance) error {
	return fmt.Errorf("something went wrong")
}

func (f *fakeFailingNotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	return definitions.Route{}, fmt.Errorf("something went wrong")
}

type fakeRejectingNotificationPolicyService struct{}

func (f *fakeRejectingNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
	return definitions.Route{}, nil
}

func (f *fakeRejectingNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree definitions.Route, p models.Provenance) error {
	return fmt.Errorf("%w: invalid policy tree", provisioning.ErrValidation)
}

func (f *fakeRejectingNotificationPolicyService) ResetPolicyTree(ctx context.Context, orgID int64) (definitions.Route, error) {
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
					From: definitions.Duration(60),
					To:   definitions.Duration(0),
				},
			},
		},
		RuleGroup:    "my-cool-group",
		FolderUID:    "folder-uid",
		For:          model.Duration(60),
		NoDataState:  definitions.OK,
		ExecErrState: definitions.OkErrState,
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
               "url":"some url",
               "use_discord_username":true
            },
            "secureSettings":{}
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
