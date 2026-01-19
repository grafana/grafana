package datasource

import (
	"encoding/json"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	queryV0 "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
)

// TODO is there a better place for this client to live?
//
// ConnectionClient provides access to datasource connection info via K8s API.
// Methods that don't take a plugin type argument are deprecated and will be removed.
//
// This client is useful for services that currently do not know about a datasource's type when fetching it.
type ConnectionClient interface {
	// GetConnectionByUID looks up a datasource connection by UID.
	// Returns the connection which contains the API group (plugin type).
	// Deprecated: Use GetConnectionByTypeAndUID instead when type is known.
	GetConnectionByUID(c *contextmodel.ReqContext, uid string) (*queryV0.DataSourceConnection, error)

	// GetConnectionByTypeAndUID looks up a datasource connection by type and UID.
	// Preferred method when the plugin type is already known.
	GetConnectionByTypeAndUID(c *contextmodel.ReqContext, pluginType, uid string) (*queryV0.DataSourceConnection, error)
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

var connectionsGVR = schema.GroupVersionResource{
	Group:    "query.grafana.app",
	Version:  "v0alpha1",
	Resource: "connections",
}

// GetConnectionByUID queries GET /apis/query.grafana.app/v0alpha1/namespaces/{ns}/connections/{uid}
// Deprecated: Use GetConnectionByTypeAndUID when type is known.
func (cl *connectionClientImpl) GetConnectionByUID(c *contextmodel.ReqContext, uid string) (*queryV0.DataSourceConnection, error) {
	client, err := dynamic.NewForConfig(cl.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		return nil, fmt.Errorf("failed to create k8s client: %w", err)
	}

	namespace := cl.namespaceMapper(c.OrgID)
	result, err := client.Resource(connectionsGVR).Namespace(namespace).Get(c.Req.Context(), uid, metav1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return nil, fmt.Errorf("datasource connection not found: %s", uid)
		}
		return nil, fmt.Errorf("failed to get connection: %w", err)
	}

	data, err := result.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("failed to marshal connection: %w", err)
	}

	var conn queryV0.DataSourceConnection
	if err := json.Unmarshal(data, &conn); err != nil {
		return nil, fmt.Errorf("failed to unmarshal connection: %w", err)
	}

	return &conn, nil
}

// GetConnectionByTypeAndUID looks up a datasource connection when the plugin type is already known.
func (cl *connectionClientImpl) GetConnectionByTypeAndUID(c *contextmodel.ReqContext, pluginType, uid string) (*queryV0.DataSourceConnection, error) {
	// When type is known, we can construct the connection name directly: {group}:{uid}
	group := pluginType + ".datasource.grafana.app"
	name := queryV0.DataSourceConnectionName(group, uid)
	return cl.GetConnectionByUID(c, name)
}

// WriteK8sError writes a K8s API error as an HTTP response.
func WriteK8sError(c *contextmodel.ReqContext, err error) {
	statusError, ok := err.(*errors.StatusError)
	if ok {
		c.JsonApiErr(int(statusError.Status().Code), statusError.Status().Message, err)
		return
	}
	c.JsonApiErr(http.StatusInternalServerError, "internal error", err)
}
