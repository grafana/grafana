package annotation

import (
	"context"
	"encoding/json"
	"fmt"

	"google.golang.org/grpc"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/annotation/annotationpb"
)

// grpcStore provides a Store implementation that communicates with a gRPC server
type grpcStore struct {
	client annotationpb.AnnotationStoreClient
}

var _ Store = (*grpcStore)(nil)

// NewGRPCStore creates a new grpcStore with the given gRPC connection
func NewGRPCStore(conn grpc.ClientConnInterface) Store {
	return &grpcStore{
		client: annotationpb.NewAnnotationStoreClient(conn),
	}
}

func (s *grpcStore) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	resp, err := s.client.Get(ctx, &annotationpb.GetRequest{
		Namespace: namespace,
		Name:      name,
	})
	if err != nil {
		return nil, fmt.Errorf("grpc Get failed: %w", err)
	}

	if resp.Annotation == nil {
		return nil, fmt.Errorf("empty annotation in response")
	}

	annotation := &annotationV0.Annotation{}
	if err := json.Unmarshal(resp.Annotation.Value, annotation); err != nil {
		return nil, fmt.Errorf("failed to unmarshal annotation: %w", err)
	}

	return annotation, nil
}

func (s *grpcStore) List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error) {
	pbOpts := &annotationpb.ListOptions{
		DashboardUid:   opts.DashboardUID,
		PanelId:        opts.PanelID,
		From:           opts.From,
		To:             opts.To,
		Limit:          opts.Limit,
		ContinueToken:  opts.Continue,
		Tags:           opts.Tags,
		TagsMatchAny:   opts.TagsMatchAny,
		Scopes:         opts.Scopes,
		ScopesMatchAny: opts.ScopesMatchAny,
	}

	resp, err := s.client.List(ctx, &annotationpb.ListRequest{
		Namespace: namespace,
		Options:   pbOpts,
	})
	if err != nil {
		return nil, fmt.Errorf("grpc List failed: %w", err)
	}

	items := make([]annotationV0.Annotation, len(resp.Items))
	for i, item := range resp.Items {
		annotation := &annotationV0.Annotation{}
		if err := json.Unmarshal(item.Value, annotation); err != nil {
			return nil, fmt.Errorf("failed to unmarshal annotation %d: %w", i, err)
		}
		items[i] = *annotation
	}

	return &AnnotationList{
		Items:    items,
		Continue: resp.ContinueToken,
	}, nil
}

func (s *grpcStore) Create(ctx context.Context, annotation *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	value, err := json.Marshal(annotation)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal annotation: %w", err)
	}

	resp, err := s.client.Create(ctx, &annotationpb.CreateRequest{
		Annotation: &annotationpb.AnnotationWrapper{
			Value: value,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("grpc Create failed: %w", err)
	}

	if resp.Annotation == nil {
		return nil, fmt.Errorf("empty annotation in response")
	}

	created := &annotationV0.Annotation{}
	if err := json.Unmarshal(resp.Annotation.Value, created); err != nil {
		return nil, fmt.Errorf("failed to unmarshal created annotation: %w", err)
	}

	return created, nil
}

func (s *grpcStore) Update(ctx context.Context, annotation *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	value, err := json.Marshal(annotation)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal annotation: %w", err)
	}

	resp, err := s.client.Update(ctx, &annotationpb.UpdateRequest{
		Annotation: &annotationpb.AnnotationWrapper{
			Value: value,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("grpc Update failed: %w", err)
	}

	if resp.Annotation == nil {
		return nil, fmt.Errorf("empty annotation in response")
	}

	updated := &annotationV0.Annotation{}
	if err := json.Unmarshal(resp.Annotation.Value, updated); err != nil {
		return nil, fmt.Errorf("failed to unmarshal updated annotation: %w", err)
	}

	return updated, nil
}

func (s *grpcStore) Delete(ctx context.Context, namespace, name string) error {
	resp, err := s.client.Delete(ctx, &annotationpb.DeleteRequest{
		Namespace: namespace,
		Name:      name,
	})
	if err != nil {
		return fmt.Errorf("grpc Delete failed: %w", err)
	}

	if !resp.Success {
		return fmt.Errorf("delete operation failed")
	}

	return nil
}
