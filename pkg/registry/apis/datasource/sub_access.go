package datasource

import (
	"context"
	"fmt"
	"net/http"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type subAccessREST struct {
	builder *DataSourceAPIBuilder
}

var _ rest.Connecter = (*subAccessREST)(nil)

func (r *subAccessREST) New() runtime.Object {
	return &datasourceV0alpha1.DatasourceAccessInfo{}
}

func (r *subAccessREST) Destroy() {
	// no-op implementation needed for rest.Storage interface.
}

func (r *subAccessREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subAccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subAccessREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	m := newConnectMetric("access", r.builder.pluginJSON.ID)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer m.Record()

		access, err := r.getAccessInfo(ctx, name)
		if err != nil {
			m.SetError()
			responder.Error(err)
		} else {
			responder.Object(200, access)
		}
	}), nil
}

type datasourceAccessAction struct {
	verb string
	name string
}

// Group the actions by subresource for readability; getAccessInfo sends them
// together so routing clients can partition each check as needed.
var datasourceAccessChecks = []struct {
	subresource string
	actions     []datasourceAccessAction
}{
	{"", []datasourceAccessAction{
		{utils.VerbGet, datasources.ActionRead},
		{utils.VerbUpdate, datasources.ActionWrite},
		{utils.VerbDelete, datasources.ActionDelete},
		{utils.VerbGetPermissions, datasources.ActionPermissionsRead},
		{utils.VerbSetPermissions, datasources.ActionPermissionsWrite},
	}},
	{"query", []datasourceAccessAction{
		{utils.VerbCreate, datasources.ActionQuery},
	}},
	{"caching", []datasourceAccessAction{
		{utils.VerbGet, "datasources.caching:read"},
		{utils.VerbUpdate, "datasources.caching:write"},
	}},
	{"alertrules", []datasourceAccessAction{
		{utils.VerbGet, accesscontrol.ActionAlertingRuleExternalRead},
		{utils.VerbUpdate, accesscontrol.ActionAlertingRuleExternalWrite},
	}},
	{"alertinstances", []datasourceAccessAction{
		{utils.VerbGet, accesscontrol.ActionAlertingInstancesExternalRead},
		{utils.VerbUpdate, accesscontrol.ActionAlertingInstancesExternalWrite},
	}},
	{"alertnotifications", []datasourceAccessAction{
		{utils.VerbGet, accesscontrol.ActionAlertingNotificationsExternalRead},
		{utils.VerbUpdate, accesscontrol.ActionAlertingNotificationsExternalWrite},
	}},
}

func (r *subAccessREST) getAccessInfo(ctx context.Context, name string) (*datasourceV0alpha1.DatasourceAccessInfo, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	namespace := request.NamespaceValue(ctx)
	if namespace == "" {
		return nil, fmt.Errorf("missing datasource namespace")
	}

	resource := r.builder.datasourceResourceInfo.GroupResource()
	result := &datasourceV0alpha1.DatasourceAccessInfo{}
	checks := make([]authlib.BatchCheckItem, 0)
	for _, batch := range datasourceAccessChecks {
		for _, action := range batch.actions {
			checks = append(checks, authlib.BatchCheckItem{
				CorrelationID: action.name,
				Group:         resource.Group,
				Resource:      resource.Resource,
				Subresource:   batch.subresource,
				Verb:          action.verb,
				Name:          name,
			})
		}
	}
	resp, err := r.builder.accessClient.BatchCheck(ctx, user, authlib.BatchCheckRequest{
		Namespace: namespace,
		Checks:    checks,
	})
	if err != nil {
		return nil, err
	}
	for _, check := range checks {
		decision, ok := resp.Results[check.CorrelationID]
		if !ok {
			return nil, fmt.Errorf("missing authorization result for %s", check.CorrelationID)
		}
		if decision.Error != nil {
			return nil, decision.Error
		}
		if decision.Allowed {
			if result.Permissions == nil {
				result.Permissions = accesscontrol.Metadata{}
			}
			result.Permissions[check.CorrelationID] = true
			// Preserve the legacy ID-read metadata key using the datasource
			// resource API's GET decision, without issuing the same check twice.
			if check.CorrelationID == datasources.ActionRead {
				result.Permissions[datasources.ActionIDRead] = true
			}
		}
	}
	return result, nil
}
