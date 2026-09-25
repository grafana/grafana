package rules

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/emicklei/go-restful/v3"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/config"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/search"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

type hybridRouteInstaller struct {
	appsdkapiserver.AppInstaller
}

func (hybridRouteInstaller) InstallAPIs(appsdkapiserver.GenericAPIServer, generic.RESTOptionsGetter) error {
	return nil
}

type hybridRouteServer struct {
	appsdkapiserver.GenericAPIServer
	services []*restful.WebService
}

func (s hybridRouteServer) RegisteredWebServices() []*restful.WebService { return s.services }

func TestInstallHybridSearchRoute(t *testing.T) {
	ws := new(restful.WebService).Path("/apis/rules.alerting.grafana.app/v0alpha1")
	server := hybridRouteServer{services: []*restful.WebService{ws}}
	installer := &AppInstaller{
		AppInstaller: hybridRouteInstaller{},
		hybridSearch: func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, "stacks-123", genericapirequest.NamespaceValue(r.Context()))
			w.WriteHeader(http.StatusNoContent)
		},
	}
	require.NoError(t, installer.InstallAPIs(server, nil))
	container := restful.NewContainer()
	container.Add(ws)
	rec := httptest.NewRecorder()
	container.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, ws.RootPath()+"/namespaces/stacks-123/search/hybrid?query=cpu", nil))
	require.Equal(t, http.StatusNoContent, rec.Code)
}

func TestHybridSearchAuthorizer(t *testing.T) {
	factory := genericapirequest.RequestInfoFactory{APIPrefixes: sets.NewString("apis"), GrouplessAPIPrefixes: sets.NewString()}
	req := httptest.NewRequest(http.MethodGet, "/apis/rules.alerting.grafana.app/v0alpha1/namespaces/stacks-123/search/hybrid?query=cpu", nil)
	info, err := factory.NewRequestInfo(req)
	require.NoError(t, err)
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "stacks-123"})
	for _, allowed := range []bool{true, false} {
		installer := &AppInstaller{ng: &ngalert.AlertNG{Api: &api.API{AccessControl: actest.FakeAccessControl{ExpectedEvaluate: allowed}}}}
		decision, _, err := installer.GetAuthorizer().Authorize(ctx, authorizer.AttributesRecord{
			Verb: info.Verb, Namespace: info.Namespace, APIGroup: info.APIGroup, APIVersion: info.APIVersion,
			Resource: info.Resource, Subresource: info.Subresource, Name: info.Name, ResourceRequest: info.IsResourceRequest,
		})
		require.NoError(t, err)
		if allowed {
			require.Equal(t, authorizer.DecisionAllow, decision)
		} else {
			require.Equal(t, authorizer.DecisionDeny, decision)
		}
	}
}

func TestRuleSearchReadAttributes(t *testing.T) {
	request := func(resource, name string) authorizer.AttributesRecord {
		return authorizer.AttributesRecord{
			Verb:            "create",
			Resource:        resource,
			Name:            name,
			ResourceRequest: true,
		}
	}

	t.Run("compatibility search is authorized as a list", func(t *testing.T) {
		for _, resource := range []string{
			alertrule.ResourceInfo.GroupResource().Resource,
			recordingrule.ResourceInfo.GroupResource().Resource,
		} {
			got := ruleSearchReadAttributes(request(resource, search.RouteResource))
			require.Equal(t, "list", got.GetVerb(), resource)
			require.Empty(t, got.GetName(), resource)
		}
	})

	t.Run("a normal create is unchanged", func(t *testing.T) {
		got := ruleSearchReadAttributes(request(alertrule.ResourceInfo.GroupResource().Resource, ""))
		require.Equal(t, "create", got.GetVerb())
	})

	t.Run("another resource is unchanged", func(t *testing.T) {
		got := ruleSearchReadAttributes(request("rulesequences", search.RouteResource))
		require.Equal(t, "create", got.GetVerb())
	})

	t.Run("a subresource request is unchanged", func(t *testing.T) {
		attr := request(alertrule.ResourceInfo.GroupResource().Resource, search.RouteResource)
		attr.Subresource = "status"
		got := ruleSearchReadAttributes(attr)
		require.Equal(t, "create", got.GetVerb())
	})

	t.Run("a non-resource request is unchanged", func(t *testing.T) {
		attr := request(alertrule.ResourceInfo.GroupResource().Resource, search.RouteResource)
		attr.ResourceRequest = false
		got := ruleSearchReadAttributes(attr)
		require.Equal(t, "create", got.GetVerb())
	})
}

func TestNewFolderValidatorRejectsRootFolder(t *testing.T) {
	validate := newFolderValidator(&ngalert.AlertNG{})

	for _, uid := range []string{folder.LegacyRootFolderUID, folder.GeneralFolderUID} { //nolint:staticcheck
		valid, err := validate(context.Background(), uid)
		require.NoError(t, err)
		require.False(t, valid)
	}
}

func TestWatchNamespace(t *testing.T) {
	tests := []struct {
		name string
		cfg  *setting.Cfg
		want string
	}{
		{name: "nil cfg watches all namespaces", cfg: nil, want: ""},
		{name: "on-prem (no stack id) watches all namespaces", cfg: &setting.Cfg{}, want: ""},
		{name: "cloud scopes to the stack namespace", cfg: &setting.Cfg{StackID: "42"}, want: "stacks-42"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, watchNamespace(tt.cfg))
		})
	}
}

func TestRegisterAppInstaller_UnifiedAlertingEnabled(t *testing.T) {
	tests := []struct {
		name            string
		enabled         bool
		expectInstaller bool
	}{
		{name: "unified_alerting disabled returns nil installer", enabled: false, expectInstaller: false},
		{name: "unified_alerting enabled returns installer", enabled: true, expectInstaller: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			enabled := tt.enabled
			cfg := &setting.Cfg{UnifiedAlerting: setting.UnifiedAlertingSettings{Enabled: &enabled}}
			ng := &ngalert.AlertNG{Cfg: cfg, Api: &api.API{AlertRules: &provisioning.AlertRuleService{}}}

			inst, err := RegisterAppInstaller(cfg, ng, nil, nil, nil)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.expectInstaller {
				require.NotNil(t, inst)
			} else {
				require.Nil(t, inst)
			}
		})
	}
}

func TestGetStorageOptions(t *testing.T) {
	a := &AppInstaller{}

	got := a.GetStorageOptions(config.ResourceInfo.GroupResource())
	require.False(t, got.EnableFolderSupport, "the Config singleton is a per-org object with no folder concept")

	got = a.GetStorageOptions(alertrule.ResourceInfo.GroupResource())
	require.True(t, got.EnableFolderSupport, "other rules-app kinds still live in folders")
}

func TestNewExternalRulerSyncDatasourceChecker(t *testing.T) {
	promDS := &datasources.DataSource{UID: "ds1", OrgID: 1, Type: datasources.DS_PROMETHEUS}
	vanillaDS := &datasources.DataSource{UID: "ds2", OrgID: 1, Type: datasources.DS_PROMETHEUS}
	vanillaDS.JsonData = simplejson.NewFromAny(map[string]any{"prometheusType": "Prometheus"})
	lokiDS := &datasources.DataSource{UID: "ds3", OrgID: 1, Type: "loki"}

	ctxFor := func(uid string) context.Context {
		ctx := genericapirequest.WithNamespace(context.Background(), "default")
		ctx = identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserID: 1})
		return ctx
	}

	enabledCfg := &setting.Cfg{}

	t.Run("operator ini override rejects writes", func(t *testing.T) {
		cfg := &setting.Cfg{UnifiedAlerting: setting.UnifiedAlertingSettings{ExternalRulerUID: "operator-ds"}}
		ds := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{promDS}}
		check := newExternalRulerSyncDatasourceChecker(cfg, ds, actest.FakeAccessControl{ExpectedEvaluate: true})
		require.Error(t, check(ctxFor("ds1"), "ds1"))
	})

	t.Run("access denied is reported the same as not found", func(t *testing.T) {
		ds := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{promDS}}
		denied := newExternalRulerSyncDatasourceChecker(enabledCfg, ds, actest.FakeAccessControl{ExpectedEvaluate: false})
		errDenied := denied(ctxFor("ds1"), "ds1")
		require.Error(t, errDenied)

		notFound := newExternalRulerSyncDatasourceChecker(enabledCfg, ds, actest.FakeAccessControl{ExpectedEvaluate: true})
		errNotFound := notFound(ctxFor("missing"), "missing")
		require.Error(t, errNotFound)

		require.Equal(t, errNotFound.Error(), errDenied.Error(), "access-denied must not be distinguishable from not-found, else the UID can be used as an existence probe")
	})

	t.Run("rejects a non-prometheus datasource", func(t *testing.T) {
		ds := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{lokiDS}}
		check := newExternalRulerSyncDatasourceChecker(enabledCfg, ds, actest.FakeAccessControl{ExpectedEvaluate: true})
		require.Error(t, check(ctxFor("ds3"), "ds3"))
	})

	t.Run("rejects vanilla prometheus", func(t *testing.T) {
		ds := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{vanillaDS}}
		check := newExternalRulerSyncDatasourceChecker(enabledCfg, ds, actest.FakeAccessControl{ExpectedEvaluate: true})
		require.Error(t, check(ctxFor("ds2"), "ds2"))
	})

	t.Run("accepts a mimir-compatible prometheus datasource without probing it", func(t *testing.T) {
		ds := &dsfakes.FakeDataSourceService{DataSources: []*datasources.DataSource{promDS}}
		check := newExternalRulerSyncDatasourceChecker(enabledCfg, ds, actest.FakeAccessControl{ExpectedEvaluate: true})
		require.NoError(t, check(ctxFor("ds1"), "ds1"))
	})
}
