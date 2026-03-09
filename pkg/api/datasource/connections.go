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
	"github.com/grafana/grafana/pkg/services/datasources"
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

// legacyConnectionClientImpl implements ConnectionClient
//
// This client is a temporary implementation so we reroute datasource CRUD requests
// without relying on the query.grafana.app API group. We're using the legacy
// datasource service just to get the datasource type, then forwarding the request
// to the new APIs.
type legacyConnectionClientImpl struct {
	datasourceService datasources.DataSourceService
}

var _ ConnectionClient = (*legacyConnectionClientImpl)(nil)

// NewLegacyConnectionClient creates a new ConnectionClient that relies on the legacy datasource service.
func NewLegacyConnectionClient(datasourceService datasources.DataSourceService) ConnectionClient {
	return &legacyConnectionClientImpl{
		datasourceService: datasourceService,
	}
}

func (cl *legacyConnectionClientImpl) GetConnectionByUID(c *contextmodel.ReqContext, uid string) (*dsV0.DataSourceConnectionList, error) {
	query := datasources.GetDataSourceQuery{
		UID:   uid,
		OrgID: c.OrgID,
	}

	conn, err := cl.datasourceService.GetDataSource(c.Req.Context(), &query)
	if err != nil {
		return nil, err
	}

	if conn == nil {
		return &dsV0.DataSourceConnectionList{
			Items: []dsV0.DataSourceConnection{},
		}, nil
	}

	return &dsV0.DataSourceConnectionList{
		Items: []dsV0.DataSourceConnection{
			{
				APIGroup:   conn.Type + ".datasource.grafana.app",
				APIVersion: "v0alpha1",
				Name:       conn.UID,
				Plugin:     conn.Type,
			},
		},
	}, nil
}
