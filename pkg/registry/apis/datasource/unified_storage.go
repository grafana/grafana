package datasource

import (
	"context"
	"fmt"

	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourcev0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
)

// DataSourceConnectionKind returns a resource.Kind for DataSourceConnection to use with GraphQL
func DataSourceConnectionKind() resource.Kind {
	// Create a simple schema for DataSourceConnection using unstructured approach
	schema := resource.NewSimpleSchema(
		"datasource.grafana.app",
		"v0alpha1",
		&resource.UntypedObject{},
		&resource.UntypedList{},
		resource.WithKind("DataSourceConnection"),
		resource.WithPlural("connections"),
		resource.WithScope(resource.NamespacedScope),
	)

	return resource.Kind{
		Schema: schema,
		Codecs: map[resource.KindEncoding]resource.Codec{
			resource.KindEncodingJSON: resource.NewJSONCodec(),
		},
	}
}

// unifiedDataSourceStorageAdapter provides access to ALL datasources across all plugin types
type unifiedDataSourceStorageAdapter struct {
	dsService       datasources.DataSourceService
	dsCache         datasources.CacheService
	namespaceMapper request.NamespaceMapper
}

// NewUnifiedDataSourceStorageAdapter creates a new unified DataSource storage adapter for GraphQL
// that can access datasources across all plugin types
func NewUnifiedDataSourceStorageAdapter(
	dsService datasources.DataSourceService,
	dsCache datasources.CacheService,
	namespaceMapper request.NamespaceMapper,
) graphqlsubgraph.Storage {
	return &unifiedDataSourceStorageAdapter{
		dsService:       dsService,
		dsCache:         dsCache,
		namespaceMapper: namespaceMapper,
	}
}

// setupContextWithNamespace sets up the proper context with namespace information for DataSource APIs
func (s *unifiedDataSourceStorageAdapter) setupContextWithNamespace(ctx context.Context, namespace string) (context.Context, error) {
	// Get the user from context
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user from context: %w", err)
	}

	// Get the org ID from the user
	orgID := user.GetOrgID()
	if orgID <= 0 {
		return nil, fmt.Errorf("invalid org ID: %d", orgID)
	}

	// Format the namespace using the namespace mapper
	properNamespace := s.namespaceMapper(orgID)

	// Set the namespace in the k8s request context
	ctx = k8srequest.WithNamespace(ctx, properNamespace)

	return ctx, nil
}

// Get implements graphqlsubgraph.Storage - fetches a single datasource connection by UID
func (s *unifiedDataSourceStorageAdapter) Get(ctx context.Context, namespace, name string) (resource.Object, error) {
	// Set up proper context with namespace information
	ctx, err := s.setupContextWithNamespace(ctx, namespace)
	if err != nil {
		return nil, err
	}

	// Get the user from context for authorization
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user from context: %w", err)
	}

	// Get the datasource by UID using the cache
	ds, err := s.dsCache.GetDatasourceByUID(ctx, name, user, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get datasource connection: %w", err)
	}

	// Get namespace info for conversion
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace info: %w", err)
	}

	// Convert to DataSourceConnection
	conn, err := asConnection(ds, info.Value)
	if err != nil {
		return nil, fmt.Errorf("failed to convert datasource to connection: %w", err)
	}

	// Convert to resource.Object format for GraphQL using UnstructuredWrapper
	return resource.NewUnstructuredWrapper(s.connectionToUnstructured(conn)), nil
}

// List implements graphqlsubgraph.Storage - fetches ALL datasource connections across all plugin types
func (s *unifiedDataSourceStorageAdapter) List(ctx context.Context, namespace string, options graphqlsubgraph.ListOptions) (resource.ListObject, error) {
	// Set up proper context with namespace information
	ctx, err := s.setupContextWithNamespace(ctx, namespace)
	if err != nil {
		return nil, err
	}

	// Get namespace info
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace info: %w", err)
	}

	// Get ALL datasources for the organization (not filtered by plugin type!)
	allDataSources, err := s.dsService.GetDataSources(ctx, &datasources.GetDataSourcesQuery{
		OrgID: info.OrgID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list datasources: %w", err)
	}

	// Convert all datasources to connections
	connections := make([]datasourcev0alpha1.DataSourceConnection, 0, len(allDataSources))
	for _, ds := range allDataSources {
		conn, err := asConnection(ds, info.Value)
		if err != nil {
			// Log the error but continue with other datasources
			continue
		}
		connections = append(connections, *conn)
	}

	// Create the connection list
	connList := &datasourcev0alpha1.DataSourceConnectionList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "datasource.grafana.app/v0alpha1",
			Kind:       "DataSourceConnectionList",
		},
		Items: connections,
	}

	// Convert to resource.ListObject format for GraphQL using UntypedList
	return s.connectionListToUntypedList(connList), nil
}

// Create implements graphqlsubgraph.Storage - creates a new datasource connection
func (s *unifiedDataSourceStorageAdapter) Create(ctx context.Context, namespace string, obj resource.Object) (resource.Object, error) {
	// DataSource connections are typically created through the datasource service, not directly
	// For now, return not implemented - this would need to integrate with the actual datasource service
	return nil, fmt.Errorf("datasource connection creation not implemented via GraphQL")
}

// Update implements graphqlsubgraph.Storage - updates an existing datasource connection
func (s *unifiedDataSourceStorageAdapter) Update(ctx context.Context, namespace, name string, obj resource.Object) (resource.Object, error) {
	// DataSource connections are typically updated through the datasource service, not directly
	// For now, return not implemented - this would need to integrate with the actual datasource service
	return nil, fmt.Errorf("datasource connection update not implemented via GraphQL")
}

// Delete implements graphqlsubgraph.Storage - deletes a datasource connection
func (s *unifiedDataSourceStorageAdapter) Delete(ctx context.Context, namespace, name string) error {
	// DataSource connections are typically deleted through the datasource service, not directly
	// For now, return not implemented - this would need to integrate with the actual datasource service
	return fmt.Errorf("datasource connection deletion not implemented via GraphQL")
}

// connectionToUnstructured converts a DataSourceConnection to an unstructured object
func (s *unifiedDataSourceStorageAdapter) connectionToUnstructured(conn *datasourcev0alpha1.DataSourceConnection) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": "datasource.grafana.app/v0alpha1",
		"kind":       "DataSourceConnection",
		"metadata": map[string]interface{}{
			"name":              conn.Name,
			"namespace":         conn.Namespace,
			"uid":               string(conn.UID),
			"resourceVersion":   conn.ResourceVersion,
			"generation":        conn.Generation,
			"creationTimestamp": conn.CreationTimestamp.Time.Format("2006-01-02T15:04:05Z"),
			"labels":            conn.Labels,
		},
		"spec": map[string]interface{}{
			"title":       conn.Title,
			"description": conn.Description,
		},
	})
	return obj
}

// connectionListToUntypedList converts a DataSourceConnectionList to resource.UntypedList
func (s *unifiedDataSourceStorageAdapter) connectionListToUntypedList(connList *datasourcev0alpha1.DataSourceConnectionList) resource.ListObject {
	items := make([]resource.Object, len(connList.Items))
	for i, conn := range connList.Items {
		// Create a copy to avoid pointer issues
		connCopy := conn
		items[i] = resource.NewUnstructuredWrapper(s.connectionToUnstructured(&connCopy))
	}

	list := &resource.UntypedList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "datasource.grafana.app/v0alpha1",
			Kind:       "DataSourceConnectionList",
		},
		ListMeta: connList.ListMeta,
		Items:    items,
	}

	return list
}
