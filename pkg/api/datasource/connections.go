package datasource

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
)

// TODO: move this to /apis/query/v0alpha1 once DirectRestConfigProvider has been
// moved to its own package (currently we get an import cycle)
//
// ConnectionClient provides access to datasource connection info via K8s API.
// Methods that don't take a plugin type argument are deprecated and will be removed.
//
// This client is useful for services that currently do not know about a datasource's type when fetching it.
type ConnectionClient interface {
	// GetConnectionByUID looks up a datasource connection by UID.
	// Returns one or more connections which contains the API group (plugin type).
	// If more that one connection is returned, it should be considered an error
	// as we cannot guarantee which resource the caller intended to get.
	//
	// Deprecated: Use /apis/<type>.datasource.grafana.app/v0alpha1/namespaces/{ns}/datasources/{uid} instead.
	GetConnectionByUID(c *contextmodel.ReqContext, uid string) (*dsV0.DataSourceConnectionList, error)
}

var _ ConnectionClient = (*connectionClientImpl)(nil)

// connectionClientImpl implements the ConnectionClient interface.
type connectionClientImpl struct {
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider
	namespaceMapper      request.NamespaceMapper
}

// NewConnectionClient creates a new ConnectionClient that queries the connections endpoint in the query api group.
func NewConnectionClient(cfg *setting.Cfg, provider grafanaapiserver.DirectRestConfigProvider) ConnectionClient {
	return &connectionClientImpl{
		clientConfigProvider: provider,
		namespaceMapper:      request.GetNamespaceMapper(cfg),
	}
}

// GetConnectionByUID queries GET /apis/datasource.grafana.app/v0alpha1/namespaces/{ns}/connections/{uid}
// Deprecated: Use GetConnectionByTypeAndUID when type is known.
func (cl *connectionClientImpl) GetConnectionByUID(c *contextmodel.ReqContext, uid string) (*dsV0.DataSourceConnectionList, error) {
	namespace := cl.namespaceMapper(c.OrgID)

	cfg := cl.clientConfigProvider.GetDirectRestConfig(c)
	cfg = dynamic.ConfigFor(cfg) // This sets NegotiatedSerializer, required for RESTClientFor
	cfg.GroupVersion = &dsV0.SchemeGroupVersion
	rest, err := rest.RESTClientFor(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create rest client: %w", err)
	}

	var statusCode int
	result := rest.Get().AbsPath("apis", dsV0.GROUP, dsV0.VERSION, "namespaces", namespace, "connections").Param("name", uid).Do(c.Req.Context()).StatusCode(&statusCode)
	err = result.Error()
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, fmt.Errorf("datasource connection not found: %s", uid)
		}
		return nil, fmt.Errorf("failed to get connection: %w", err)
	}

	body, _ := result.Raw() // err has already been checked

	var conn dsV0.DataSourceConnectionList
	if err := json.Unmarshal(body, &conn); err != nil {
		return nil, fmt.Errorf("failed to unmarshal connection: %w", err)
	}

	return &conn, nil
}
