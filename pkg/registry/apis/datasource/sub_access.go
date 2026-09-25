package datasource

import (
	"context"
	"fmt"
	"net/http"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

type subAccessREST struct {
	builder *DataSourceAPIBuilder
}

var _ = rest.Connecter(&subAccessREST{})

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

func (r *subAccessREST) getAccessInfo(ctx context.Context, name string) (*datasourceV0alpha1.DatasourceAccessInfo, error) {
	ns, err := request.NamespaceInfoFrom(ctx, false)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// These are the permissions consumed by datasource settings, permissions,
	// and caching UI. Keep the batch homogeneous for authz rollout routing.
	checks := []struct {
		verb   string
		action string
	}{
		{utils.VerbUpdate, "datasources:write"},
		{utils.VerbDelete, "datasources:delete"},
		{utils.VerbGetPermissions, "datasources.permissions:read"},
		{utils.VerbSetPermissions, "datasources.permissions:write"},
		{utils.VerbGetCaching, "datasources.caching:read"},
		{utils.VerbSetCaching, "datasources.caching:write"},
	}
	items := make([]authlib.BatchCheckItem, 0, len(checks))
	for _, check := range checks {
		items = append(items, authlib.BatchCheckItem{
			CorrelationID: check.verb,
			Group:         r.builder.GetGroupVersion().Group,
			Resource:      r.builder.datasourceResourceInfo.GroupResource().Resource,
			Name:          name,
			Verb:          check.verb,
		})
	}
	response, err := r.builder.accessClient.BatchCheck(ctx, user, authlib.BatchCheckRequest{
		Namespace: ns.Value,
		Checks:    items,
	})
	if err != nil {
		return nil, err
	}

	var permissions accesscontrol.Metadata
	for _, check := range checks {
		result, ok := response.Results[check.verb]
		if !ok {
			return nil, fmt.Errorf("missing access check result for %s", check.action)
		}
		if result.Error != nil {
			return nil, fmt.Errorf("checking %s: %w", check.action, result.Error)
		}
		if result.Allowed {
			if permissions == nil {
				permissions = accesscontrol.Metadata{}
			}
			permissions[check.action] = true
		}
	}
	return &datasourceV0alpha1.DatasourceAccessInfo{
		Permissions: permissions,
	}, nil
}
