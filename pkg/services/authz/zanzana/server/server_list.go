package server

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"strings"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) List(ctx context.Context, r *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.List")
	defer span.End()
	span.SetAttributes(attribute.String("namespace", r.GetNamespace()))

	defer func(t time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("server.List", r.GetNamespace()).Observe(time.Since(t).Seconds())
	}(time.Now())

	res, err := s.list(ctx, r)
	if err != nil {
		s.logger.Error("failed to perform list request", "error", err, "namespace", r.GetNamespace())
		return nil, errors.New("failed to perform list request")
	}

	return res, nil
}

func (s *Server) list(ctx context.Context, r *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	if err := authorize(ctx, r.GetNamespace(), s.cfg); err != nil {
		return nil, err
	}

	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
	}

	contextuals, err := s.getContextuals(r.GetSubject())
	if err != nil {
		return nil, fmt.Errorf("failed to get contextual tuples: %w", err)
	}

	relation := common.VerbMapping[r.GetVerb()]
	resource := common.NewResourceInfoFromList(r)

	res, err := s.checkGroupResource(ctx, r.GetSubject(), relation, resource, contextuals, store)
	if err != nil {
		return nil, fmt.Errorf("failed to check group resource: %w", err)
	}

	if res.GetAllowed() {
		return &authzv1.ListResponse{All: true}, nil
	}

	if resource.IsGeneric() {
		return s.listGeneric(ctx, r.GetSubject(), relation, resource, contextuals, store)
	}

	return s.listTyped(ctx, r.GetSubject(), relation, resource, contextuals, store)
}

func (s *Server) listTyped(ctx context.Context, subject, relation string, resource common.ResourceInfo, contextuals *openfgav1.ContextualTupleKeys, store *storeInfo) (*authzv1.ListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.listTyped")
	defer span.End()

	if !resource.IsValidRelation(relation) {
		return &authzv1.ListResponse{}, nil
	}

	var (
		subresourceRelation = common.SubresourceRelation(relation)
		resourceCtx         = resource.Context()
	)

	var items []string
	if resource.HasSubresource() && common.IsSubresourceRelation(subresourceRelation) {
		// List requested subresources
		res, err := s.listObjects(ctx, &openfgav1.ListObjectsRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			Type:                 resource.Type(),
			Relation:             subresourceRelation,
			User:                 subject,
			Context:              resourceCtx,
			ContextualTuples:     contextuals,
		})

		if err != nil {
			return nil, err
		}

		items = append(items, typedObjects(resource.Type(), res.GetObjects())...)
	}

	// List all resources user has access too
	res, err := s.listObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Type:                 resource.Type(),
		Relation:             relation,
		User:                 subject,
		ContextualTuples:     contextuals,
	})
	if err != nil {
		return nil, err
	}
	items = append(items, typedObjects(resource.Type(), res.GetObjects())...)

	return &authzv1.ListResponse{
		Items: items,
	}, nil
}

func (s *Server) listGeneric(ctx context.Context, subject, relation string, resource common.ResourceInfo, contextuals *openfgav1.ContextualTupleKeys, store *storeInfo) (*authzv1.ListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.listGeneric")
	defer span.End()

	var (
		folderRelation = common.SubresourceRelation(relation)
		resourceCtx    = resource.Context()
	)

	// 1. List all folders subject has access to resource type in
	var folders []string
	if common.IsSubresourceRelation(folderRelation) {
		res, err := s.listObjects(ctx, &openfgav1.ListObjectsRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			Type:                 common.TypeFolder,
			Relation:             folderRelation,
			User:                 subject,
			Context:              resourceCtx,
			ContextualTuples:     contextuals,
		})

		if err != nil {
			return nil, err
		}

		folders = res.GetObjects()
	}

	// 2. List all resource directly assigned to subject
	var objects []string
	if resource.IsValidRelation(relation) {
		res, err := s.listObjects(ctx, &openfgav1.ListObjectsRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			Type:                 common.TypeResource,
			Relation:             relation,
			User:                 subject,
			Context:              resourceCtx,
			ContextualTuples:     contextuals,
		})
		if err != nil {
			return nil, err
		}

		objects = res.GetObjects()
	}

	return &authzv1.ListResponse{
		Folders: folderObject(folders),
		Items:   genericObjects(resource.GroupResource(), objects),
	}, nil
}

func (s *Server) listObjects(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	fn := s.openfga.ListObjects
	if s.cfg.UseStreamedListObjects {
		fn = s.streamedListObjects
	}

	if s.cfg.CacheSettings.CheckQueryCacheEnabled {
		return s.listObjectCached(ctx, req, fn)
	}

	res, err := fn(ctx, req)
	if err != nil {
		s.logger.Error("failed to perform openfga ListObjects request", "error", errors.Unwrap(err), "user", req.GetUser(), "type", req.GetType(), "relation", req.GetRelation())
		return nil, err
	}

	return res, nil
}

type listFn func(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error)

func (s *Server) listObjectCached(ctx context.Context, req *openfgav1.ListObjectsRequest, fn listFn) (*openfgav1.ListObjectsResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.listObjectCached")
	defer span.End()

	key, err := getRequestHash(req)
	if err != nil {
		return nil, err
	}

	if res, ok := s.cache.Get(key); ok {
		return res.(*openfgav1.ListObjectsResponse), nil
	}

	res, err := fn(ctx, req)
	if err != nil {
		return nil, err
	}

	s.cache.Set(key, res, 0)
	return res, nil
}

func (s *Server) streamedListObjects(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.streamedListObjects")
	defer span.End()

	r := &openfgav1.StreamedListObjectsRequest{
		StoreId:              req.GetStoreId(),
		AuthorizationModelId: req.GetAuthorizationModelId(),
		Type:                 req.GetType(),
		Relation:             req.GetRelation(),
		User:                 req.GetUser(),
		Context:              req.GetContext(),
		ContextualTuples:     req.ContextualTuples,
	}

	stream, err := s.openfgaClient.StreamedListObjects(ctx, r)
	if err != nil {
		return nil, err
	}

	var objects []string
	for {
		res, err := stream.Recv()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}
		objects = append(objects, res.GetObject())
	}

	return &openfgav1.ListObjectsResponse{
		Objects: objects,
	}, nil
}

func getRequestHash(req *openfgav1.ListObjectsRequest) (string, error) {
	hash := fnv.New64a()
	_, err := hash.Write([]byte(req.String()))
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(hash.Sum(nil)), nil
}

func typedObjects(typ string, objects []string) []string {
	prefix := typ + ":"
	for i := range objects {
		objects[i] = strings.TrimPrefix(objects[i], prefix)
	}
	return objects
}

func genericObjects(gr string, objects []string) []string {
	prefix := common.TypeResourcePrefix + gr + "/"
	for i := range objects {
		objects[i] = strings.TrimPrefix(objects[i], prefix)
	}
	return objects
}

func folderObject(objects []string) []string {
	for i := range objects {
		objects[i] = strings.TrimPrefix(objects[i], common.TypeFolderPrefix)
	}
	return objects
}
