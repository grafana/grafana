package entitybridge

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/klog/v2"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Creates a ResourceServer using the existing entity tables
// NOTE: the server is optional and only used to pass init+close functions
func EntityAsResourceServer(client entity.EntityStoreClient, server sqlstash.SqlEntityServer, tracer tracing.Tracer) (resource.ResourceServer, error) {
	if client == nil {
		return nil, fmt.Errorf("client must be defined")
	}

	// Use this bridge as the resource store
	bridge := &entityBridge{
		client: client,
		server: server,
	}
	return resource.NewResourceServer(resource.ResourceServerOptions{
		Tracer:      tracer,
		Backend:     bridge,
		Diagnostics: bridge,
		Lifecycle:   bridge,
	})
}

// This is only created if we use the entity implementation
type entityBridge struct {
	client entity.EntityStoreClient

	// When running directly
	// (we need the explicit version so we have access to init+stop)
	server sqlstash.SqlEntityServer
}

// Init implements ResourceServer.
func (b *entityBridge) Init(context.Context) error {
	if b.server != nil {
		return b.server.Init()
	}
	return nil
}

// Stop implements ResourceServer.
func (b *entityBridge) Stop(context.Context) error {
	if b.server != nil {
		b.server.Stop()
	}
	return nil
}

// Convert resource key to the entity key
func toEntityKey(key *resource.ResourceKey) string {
	e := grafanaregistry.Key{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	}
	return e.String()
}

func (b *entityBridge) WriteEvent(ctx context.Context, event resource.WriteEvent) (int64, error) {
	key := toEntityKey(event.Key)

	// Delete does not need to create an entity first
	if event.Type == resource.WatchEvent_DELETED {
		rsp, err := b.client.Delete(ctx, &entity.DeleteEntityRequest{
			Key:             key,
			PreviousVersion: event.PreviousRV,
		})
		if err != nil {
			return 0, err
		}
		return rsp.Entity.ResourceVersion, err
	}

	gvr := event.Object.GetGroupVersionKind()
	obj := event.Object
	msg := &entity.Entity{
		Key:          key,
		Group:        event.Key.Group,
		Resource:     event.Key.Resource,
		Namespace:    event.Key.Namespace,
		Name:         event.Key.Name,
		Guid:         string(event.Object.GetUID()),
		GroupVersion: gvr.Version,

		Folder:  obj.GetFolder(),
		Body:    event.Value,
		Message: event.Object.GetMessage(),

		Labels: obj.GetLabels(),
		Size:   int64(len(event.Value)),
	}

	switch event.Type {
	case resource.WatchEvent_ADDED:
		msg.Action = entity.Entity_CREATED
		rsp, err := b.client.Create(ctx, &entity.CreateEntityRequest{Entity: msg})
		if err != nil {
			return 0, err
		}
		return rsp.Entity.ResourceVersion, err

	case resource.WatchEvent_MODIFIED:
		msg.Action = entity.Entity_UPDATED
		rsp, err := b.client.Update(ctx, &entity.UpdateEntityRequest{
			Entity:          msg,
			PreviousVersion: event.PreviousRV,
		})
		if err != nil {
			return 0, err
		}
		return rsp.Entity.ResourceVersion, err

	default:
	}

	return 0, fmt.Errorf("unsupported operation: %s", event.Type.String())
}

func (b *entityBridge) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	client, err := b.client.Watch(ctx)
	if err != nil {
		return nil, err
	}

	req := &entity.EntityWatchRequest{
		Action:            entity.EntityWatchRequest_START,
		Labels:            map[string]string{},
		WithBody:          true,
		WithStatus:        true,
		SendInitialEvents: false,
	}

	err = client.Send(req)
	if err != nil {
		err2 := client.CloseSend()
		if err2 != nil {
			klog.Errorf("watch close failed: %s\n", err2)
		}
		return nil, err
	}

	reader := &decoder{client}
	stream := make(chan *resource.WrittenEvent, 10)
	go func() {
		for {
			evt, err := reader.next()
			if err != nil {
				reader.close()
				close(stream)
				return
			}
			stream <- evt
		}
	}()
	return stream, nil
}

// IsHealthy implements ResourceServer.
func (b *entityBridge) IsHealthy(ctx context.Context, req *resource.HealthCheckRequest) (*resource.HealthCheckResponse, error) {
	rsp, err := b.client.IsHealthy(ctx, &entity.HealthCheckRequest{
		Service: req.Service, // ??
	})
	if err != nil {
		return nil, err
	}
	return &resource.HealthCheckResponse{
		Status: resource.HealthCheckResponse_ServingStatus(rsp.Status),
	}, nil
}

// Read implements ResourceServer.
func (b *entityBridge) Read(ctx context.Context, req *resource.ReadRequest) (*resource.ReadResponse, error) {
	v, err := b.client.Read(ctx, &entity.ReadEntityRequest{
		Key:      toEntityKey(req.Key),
		WithBody: true,
	})
	if err != nil {
		return nil, err
	}
	return &resource.ReadResponse{
		ResourceVersion: v.ResourceVersion,
		Value:           v.Body,
	}, nil
}

// List implements ResourceServer.
func (b *entityBridge) PrepareList(ctx context.Context, req *resource.ListRequest) (*resource.ListResponse, error) {
	key := req.Options.Key
	query := &entity.EntityListRequest{
		NextPageToken: req.NextPageToken,
		Limit:         req.Limit,
		Key:           []string{toEntityKey(key)},
		WithBody:      true,
	}

	if len(req.Options.Labels) > 0 {
		query.Labels = make(map[string]string)
		for _, q := range req.Options.Labels {
			// The entity structure only supports equals
			// the rest will be processed handled by the upstream predicate
			op := selection.Operator(q.Operator)
			if op == selection.Equals || op == selection.DoubleEquals {
				query.Labels[q.Key] = q.Values[0]
			}
		}
	}

	found, err := b.client.List(ctx, query)
	if err != nil {
		return nil, err
	}

	rsp := &resource.ListResponse{
		ResourceVersion: found.ResourceVersion,
		NextPageToken:   found.NextPageToken,
	}
	for _, item := range found.Results {
		rsp.Items = append(rsp.Items, &resource.ResourceWrapper{
			ResourceVersion: item.ResourceVersion,
			Value:           item.Body,
		})
	}
	return rsp, nil
}
