package annotation

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	storev1 "github.com/grafana/grafana/pkg/registry/apps/annotation/storepb/v1"
)

// storeGRPC provides a gRPC client implementation of the Store,
// LifecycleManager, and TagProvider interfaces
type storeGRPC struct {
	client storev1.AnnotationStoreClient
}

var _ Store = (*storeGRPC)(nil)
var _ LifecycleManager = (*storeGRPC)(nil)
var _ TagProvider = (*storeGRPC)(nil)

// NewStoreGRPC creates a new gRPC-based annotation store client
func NewStoreGRPC(conn grpc.ClientConnInterface) *storeGRPC {
	return &storeGRPC{
		client: storev1.NewAnnotationStoreClient(conn),
	}
}

func (s *storeGRPC) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	req := &storev1.GetRequest{
		Namespace: namespace,
		Name:      name,
	}

	resp, err := s.client.Get(ctx, req)
	if err != nil {
		return nil, mapGRPCError(err)
	}

	return fromProtoAnnotation(resp.Annotation), nil
}

func (s *storeGRPC) List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error) {
	req := &storev1.ListRequest{
		Namespace: namespace,
		Options:   toProtoListOptions(opts),
	}

	resp, err := s.client.List(ctx, req)
	if err != nil {
		return nil, mapGRPCError(err)
	}

	items := make([]annotationV0.Annotation, 0, len(resp.Items))
	for _, protoAnno := range resp.Items {
		items = append(items, *fromProtoAnnotation(protoAnno))
	}

	return &AnnotationList{
		Items:    items,
		Continue: resp.Continue,
	}, nil
}

func (s *storeGRPC) Create(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	req := &storev1.CreateRequest{
		Annotation: toProtoAnnotation(anno),
	}

	resp, err := s.client.Create(ctx, req)
	if err != nil {
		return nil, mapGRPCError(err)
	}

	return fromProtoAnnotation(resp.Annotation), nil
}

func (s *storeGRPC) Update(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	req := &storev1.UpdateRequest{
		Annotation: toProtoAnnotation(anno),
	}

	resp, err := s.client.Update(ctx, req)
	if err != nil {
		return nil, mapGRPCError(err)
	}

	return fromProtoAnnotation(resp.Annotation), nil
}

func (s *storeGRPC) Delete(ctx context.Context, namespace, name string) error {
	req := &storev1.DeleteRequest{
		Namespace: namespace,
		Name:      name,
	}

	_, err := s.client.Delete(ctx, req)
	if err != nil {
		return mapGRPCError(err)
	}

	return nil
}

func (s *storeGRPC) Cleanup(ctx context.Context) (int64, error) {
	req := &storev1.CleanupRequest{}

	resp, err := s.client.Cleanup(ctx, req)
	if err != nil {
		return 0, mapGRPCError(err)
	}

	return resp.DeletedCount, nil
}

func (s *storeGRPC) ListTags(ctx context.Context, namespace string, opts TagListOptions) ([]Tag, error) {
	req := &storev1.ListTagsRequest{
		Namespace: namespace,
		Options:   toProtoTagListOptions(opts),
	}

	resp, err := s.client.ListTags(ctx, req)
	if err != nil {
		return nil, mapGRPCError(err)
	}

	tags := make([]Tag, 0, len(resp.Tags))
	for _, protoTag := range resp.Tags {
		tags = append(tags, Tag{
			Name:  protoTag.Name,
			Count: protoTag.Count,
		})
	}

	return tags, nil
}

// toProtoListOptions converts ListOptions to proto ListOptions
func toProtoListOptions(opts ListOptions) *storev1.ListOptions {
	return &storev1.ListOptions{
		DashboardUid:   opts.DashboardUID,
		PanelId:        opts.PanelID,
		From:           opts.From,
		To:             opts.To,
		Limit:          opts.Limit,
		Continue:       opts.Continue,
		Tags:           opts.Tags,
		TagsMatchAny:   opts.TagsMatchAny,
		Scopes:         opts.Scopes,
		ScopesMatchAny: opts.ScopesMatchAny,
		CreatedBy:      opts.CreatedBy,
	}
}

// fromProtoListOptions converts proto ListOptions to internal ListOptions
func fromProtoListOptions(opts *storev1.ListOptions) ListOptions {
	if opts == nil {
		return ListOptions{}
	}

	return ListOptions{
		DashboardUID:   opts.DashboardUid,
		PanelID:        opts.PanelId,
		From:           opts.From,
		To:             opts.To,
		Limit:          opts.Limit,
		Continue:       opts.Continue,
		Tags:           opts.Tags,
		TagsMatchAny:   opts.TagsMatchAny,
		Scopes:         opts.Scopes,
		ScopesMatchAny: opts.ScopesMatchAny,
		CreatedBy:      opts.CreatedBy,
	}
}

// toProtoTagListOptions converts TagListOptions to proto TagListOptions
func toProtoTagListOptions(opts TagListOptions) *storev1.TagListOptions {
	return &storev1.TagListOptions{
		Prefix: opts.Prefix,
		Limit:  int32(opts.Limit),
	}
}

// fromProtoTagListOptions converts proto TagListOptions to internal TagListOptions
func fromProtoTagListOptions(opts *storev1.TagListOptions) TagListOptions {
	if opts == nil {
		return TagListOptions{}
	}

	return TagListOptions{
		Prefix: opts.Prefix,
		Limit:  int(opts.Limit),
	}
}

// mapGRPCError maps gRPC errors to appropriate application errors
func mapGRPCError(err error) error {
	if err == nil {
		return nil
	}

	st, ok := status.FromError(err)
	if !ok {
		return err
	}

	switch st.Code() {
	case codes.NotFound:
		return fmt.Errorf("annotation not found")
	case codes.AlreadyExists:
		return fmt.Errorf("annotation already exists")
	case codes.InvalidArgument:
		return fmt.Errorf("invalid argument: %s", st.Message())
	default:
		return fmt.Errorf("grpc error: %s", st.Message())
	}
}

// mapToGRPCStatus maps application errors to gRPC status codes
func mapToGRPCStatus(err error) error {
	if err == nil {
		return nil
	}

	msg := err.Error()

	if strings.Contains(msg, "not found") {
		return status.Error(codes.NotFound, msg)
	}
	if strings.Contains(msg, "already exists") {
		return status.Error(codes.AlreadyExists, msg)
	}
	if strings.Contains(msg, "invalid") {
		return status.Error(codes.InvalidArgument, msg)
	}

	return status.Error(codes.Internal, msg)
}

// toProtoAnnotation converts a v0alpha1.Annotation to proto Annotation
func toProtoAnnotation(anno *annotationV0.Annotation) *storev1.Annotation {
	if anno == nil {
		return nil
	}

	protoAnno := &storev1.Annotation{
		Name:      anno.Name,
		Namespace: anno.Namespace,
		CreatedBy: anno.GetCreatedBy(),
		Spec: &storev1.AnnotationSpec{
			Text:   anno.Spec.Text,
			Time:   anno.Spec.Time,
			Tags:   anno.Spec.Tags,
			Scopes: anno.Spec.Scopes,
		},
	}

	// Set optional fields
	if anno.Spec.TimeEnd != nil {
		protoAnno.Spec.TimeEnd = anno.Spec.TimeEnd
	}
	if anno.Spec.DashboardUID != nil {
		protoAnno.Spec.DashboardUid = anno.Spec.DashboardUID
	}
	if anno.Spec.PanelID != nil {
		protoAnno.Spec.PanelId = anno.Spec.PanelID
	}

	return protoAnno
}

// fromProtoAnnotation converts a proto Annotation to v0alpha1.Annotation
func fromProtoAnnotation(protoAnno *storev1.Annotation) *annotationV0.Annotation {
	if protoAnno == nil {
		return nil
	}

	anno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:      protoAnno.Name,
			Namespace: protoAnno.Namespace,
		},
	}

	if protoAnno.CreatedBy != "" {
		anno.SetCreatedBy(protoAnno.CreatedBy)
	}

	if protoAnno.Spec != nil {
		anno.Spec = annotationV0.AnnotationSpec{
			Text:   protoAnno.Spec.Text,
			Time:   protoAnno.Spec.Time,
			Tags:   protoAnno.Spec.Tags,
			Scopes: protoAnno.Spec.Scopes,
		}

		// Set optional fields
		if protoAnno.Spec.TimeEnd != nil {
			anno.Spec.TimeEnd = protoAnno.Spec.TimeEnd
		}
		if protoAnno.Spec.DashboardUid != nil {
			anno.Spec.DashboardUID = protoAnno.Spec.DashboardUid
		}
		if protoAnno.Spec.PanelId != nil {
			anno.Spec.PanelID = protoAnno.Spec.PanelId
		}
	}

	return anno
}
