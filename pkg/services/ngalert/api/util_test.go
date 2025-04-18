package api

import (
	"math/rand"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/auth"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	models2 "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func TestToMacaronPath(t *testing.T) {
	testCases := []struct {
		inputPath          string
		expectedOutputPath string
	}{
		{
			inputPath:          "",
			expectedOutputPath: "",
		},
		{
			inputPath:          "/ruler/{DatasourceID}/api/v1/rules/{Namespace}/{Groupname}",
			expectedOutputPath: "/ruler/:DatasourceID/api/v1/rules/:Namespace/:Groupname",
		},
	}
	for _, tc := range testCases {
		outputPath := toMacaronPath(tc.inputPath)
		assert.Equal(t, tc.expectedOutputPath, outputPath)
	}
}

func TestAlertingProxy_createProxyContext(t *testing.T) {
	ctx := &contextmodel.ReqContext{
		Context: &web.Context{
			Req: &http.Request{},
		},
		SignedInUser:               &user.SignedInUser{},
		UserToken:                  &auth.UserToken{},
		IsSignedIn:                 rand.Int63()%2 == 1,
		IsRenderCall:               rand.Int63()%2 == 1,
		AllowAnonymous:             rand.Int63()%2 == 1,
		SkipDSCache:                rand.Int63()%2 == 1,
		SkipQueryCache:             rand.Int63()%2 == 1,
		Logger:                     log.New("test"),
		RequestNonce:               util.GenerateShortUID(),
		PublicDashboardAccessToken: util.GenerateShortUID(),
	}

	t.Run("should create a copy of request context", func(t *testing.T) {
		for _, mock := range []*accesscontrolmock.Mock{
			accesscontrolmock.New(), accesscontrolmock.New(),
		} {
			proxy := AlertingProxy{
				DataProxy: nil,
				ac:        mock,
			}

			req := &http.Request{}
			resp := &response.NormalResponse{}

			newCtx := proxy.createProxyContext(ctx, req, resp)

			require.NotEqual(t, ctx, newCtx)
			require.Equal(t, ctx.UserToken, newCtx.UserToken)
			require.Equal(t, ctx.IsSignedIn, newCtx.IsSignedIn)
			require.Equal(t, ctx.IsRenderCall, newCtx.IsRenderCall)
			require.Equal(t, ctx.AllowAnonymous, newCtx.AllowAnonymous)
			require.Equal(t, ctx.SkipDSCache, newCtx.SkipDSCache)
			require.Equal(t, ctx.SkipQueryCache, newCtx.SkipQueryCache)
			require.Equal(t, ctx.Logger, newCtx.Logger)
			require.Equal(t, ctx.RequestNonce, newCtx.RequestNonce)
			require.Equal(t, ctx.PublicDashboardAccessToken, newCtx.PublicDashboardAccessToken)
		}
	})
	t.Run("should overwrite response writer", func(t *testing.T) {
		proxy := AlertingProxy{
			DataProxy: nil,
			ac:        accesscontrolmock.New(),
		}

		req := &http.Request{}
		resp := &response.NormalResponse{}

		newCtx := proxy.createProxyContext(ctx, req, resp)

		require.NotEqual(t, ctx.Resp, newCtx.Resp)
		require.Equal(t, ctx.Req, newCtx.Req)

		require.NotEqual(t, 123, resp.Status())
		newCtx.Resp.WriteHeader(123)
		require.Equal(t, 123, resp.Status())
	})
	t.Run("if access control is enabled", func(t *testing.T) {
		t.Run("should elevate permissions to Editor for Viewer", func(t *testing.T) {
			proxy := AlertingProxy{
				DataProxy: nil,
				ac:        accesscontrolmock.New(),
			}

			req := &http.Request{}
			resp := &response.NormalResponse{}

			viewerCtx := *ctx
			viewerCtx.SignedInUser = &user.SignedInUser{
				OrgRole: org.RoleViewer,
			}

			newCtx := proxy.createProxyContext(&viewerCtx, req, resp)
			require.NotEqual(t, viewerCtx.SignedInUser, newCtx.SignedInUser)
			require.Truef(t, newCtx.HasRole(org.RoleEditor), "user of the proxy request should have at least Editor role but has %s", newCtx.OrgRole)
		})
		t.Run("should not alter user if it is Editor", func(t *testing.T) {
			proxy := AlertingProxy{
				DataProxy: nil,
				ac:        accesscontrolmock.New(),
			}

			req := &http.Request{}
			resp := &response.NormalResponse{}

			for _, roleType := range []org.RoleType{org.RoleEditor, org.RoleAdmin} {
				roleCtx := *ctx
				roleCtx.SignedInUser = &user.SignedInUser{
					OrgRole: roleType,
				}
				newCtx := proxy.createProxyContext(&roleCtx, req, resp)
				require.Equalf(t, roleCtx.SignedInUser, newCtx.SignedInUser, "user should not be altered if role is %s", roleType)
			}
		})
	})
}

func Test_containsProvisionedAlerts(t *testing.T) {
	gen := models2.RuleGen
	t.Run("should return true if at least one rule is provisioned", func(t *testing.T) {
		rules := gen.GenerateManyRef(2, 6)
		provenance := map[string]models2.Provenance{
			rules[rand.Intn(len(rules))].UID: []models2.Provenance{models2.ProvenanceAPI, models2.ProvenanceFile}[rand.Intn(2)],
		}
		require.Truef(t, containsProvisionedAlerts(provenance, rules), "the group of rules is expected to be considered as provisioned but it isn't. Provenances: %v", provenance)
	})
	t.Run("should return false if map does not contain or has ProvenanceNone", func(t *testing.T) {
		rules := gen.GenerateManyRef(1, 6)
		provenance := make(map[string]models2.Provenance)
		numProvenanceNone := rand.Intn(len(rules))
		for i := 0; i < numProvenanceNone; i++ {
			provenance[rules[i].UID] = models2.ProvenanceNone
		}
		require.Falsef(t, containsProvisionedAlerts(provenance, rules), "the group of rules is not expected to be provisioned but it is. Provenances: %v", provenance)
	})
}

type recordingConditionValidator struct {
	recorded []models2.Condition
	hook     func(c models2.Condition) error
}

func (r *recordingConditionValidator) Validate(_ eval.EvaluationContext, condition models2.Condition) error {
	r.recorded = append(r.recorded, condition)
	if r.hook != nil {
		return r.hook(condition)
	}
	return nil
}

var _ ConditionValidator = &recordingConditionValidator{}

func TestIsPrometheusCompatible(t *testing.T) {
	testCases := []struct {
		name     string
		dsType   string
		expected bool
	}{
		{
			name:     "prometheus datasource should be compatible",
			dsType:   datasources.DS_PROMETHEUS,
			expected: true,
		},
		{
			name:     "amazon prometheus datasource should be compatible",
			dsType:   datasources.DS_AMAZON_PROMETHEUS,
			expected: true,
		},
		{
			name:     "azure prometheus datasource should be compatible",
			dsType:   datasources.DS_AZURE_PROMETHEUS,
			expected: true,
		},
		{
			name:     "loki datasource should not be prometheus compatible",
			dsType:   datasources.DS_LOKI,
			expected: false,
		},
		{
			name:     "other datasource types should not be compatible",
			dsType:   "some-other-datasource",
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := isPrometheusCompatible(tc.dsType)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestIsLotexRulerCompatible(t *testing.T) {
	testCases := []struct {
		name     string
		dsType   string
		expected bool
	}{
		{
			name:     "prometheus datasource should be compatible",
			dsType:   datasources.DS_PROMETHEUS,
			expected: true,
		},
		{
			name:     "amazon prometheus datasource should be compatible",
			dsType:   datasources.DS_AMAZON_PROMETHEUS,
			expected: true,
		},
		{
			name:     "azure prometheus datasource should be compatible",
			dsType:   datasources.DS_AZURE_PROMETHEUS,
			expected: true,
		},
		{
			name:     "loki datasource should be compatible",
			dsType:   datasources.DS_LOKI,
			expected: true,
		},
		{
			name:     "other datasource types should not be compatible",
			dsType:   "some-other-datasource",
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := isLotexRulerCompatible(tc.dsType)
			assert.Equal(t, tc.expected, result)
		})
	}
}
