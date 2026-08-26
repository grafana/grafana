package rules

import (
	"testing"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	rulesApp "github.com/grafana/grafana/apps/alerting/rules/pkg/app"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

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
			got := ruleSearchReadAttributes(request(resource, rulesApp.SearchRulesPathSegment))
			require.Equal(t, "list", got.GetVerb(), resource)
			require.Empty(t, got.GetName(), resource)
		}
	})

	t.Run("a normal create is unchanged", func(t *testing.T) {
		got := ruleSearchReadAttributes(request(alertrule.ResourceInfo.GroupResource().Resource, ""))
		require.Equal(t, "create", got.GetVerb())
	})

	t.Run("another resource is unchanged", func(t *testing.T) {
		got := ruleSearchReadAttributes(request("rulesequences", rulesApp.SearchRulesPathSegment))
		require.Equal(t, "create", got.GetVerb())
	})

	t.Run("a subresource request is unchanged", func(t *testing.T) {
		attr := request(alertrule.ResourceInfo.GroupResource().Resource, rulesApp.SearchRulesPathSegment)
		attr.Subresource = "status"
		got := ruleSearchReadAttributes(attr)
		require.Equal(t, "create", got.GetVerb())
	})

	t.Run("a non-resource request is unchanged", func(t *testing.T) {
		attr := request(alertrule.ResourceInfo.GroupResource().Resource, rulesApp.SearchRulesPathSegment)
		attr.ResourceRequest = false
		got := ruleSearchReadAttributes(attr)
		require.Equal(t, "create", got.GetVerb())
	})
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
