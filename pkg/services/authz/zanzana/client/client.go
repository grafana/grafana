package client

import (
	"context"
	"errors"
	"strconv"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var (
	ErrTranslationNotImplemented = errors.New("action translation is not implemented for resource")
)

var _ zanzana.ZanzanaClient = (*ZanzanaClient)(nil)

type ZanzanaClient struct {
	logger        log.Logger
	openfgaClient zanzana.OpenFGAClient
}

func NewZanzanaClient(openfgaClient zanzana.OpenFGAClient) (*ZanzanaClient, error) {
	client := &ZanzanaClient{
		logger:        log.New("zanzana"),
		openfgaClient: openfgaClient,
	}

	return client, nil
}

func (c *ZanzanaClient) Check(ctx context.Context, caller claims.AuthInfo, req *authzlib.CheckRequest) (authzlib.CheckResponse, error) {
	ns, err := claims.ParseNamespace(req.Namespace)
	if err != nil {
		return authzlib.CheckResponse{}, err
	}

	tupleKey, ok := zanzana.TranslateToTuple(caller.GetUID(), req.Action, req.Resource, req.Name, ns.OrgID)
	if !ok {
		// unsupported translation
		c.logger.Debug("unsupported translation", "action", req.Action, "kind", req.Resource)
		return authzlib.CheckResponse{}, ErrTranslationNotImplemented
	}

	key := &openfgav1.CheckRequestTupleKey{
		User:     tupleKey.User,
		Relation: tupleKey.Relation,
		Object:   tupleKey.Object,
	}

	in := &openfgav1.CheckRequest{
		TupleKey: key,
	}

	// Check direct access to resource first
	res, err := c.openfgaClient.Check(ctx, in)
	if err != nil {
		return authzlib.CheckResponse{}, err
	}

	// no need to check folder access
	if res.Allowed || req.Parent == "" {
		return authzlib.CheckResponse{Allowed: res.Allowed}, nil
	}

	// Check access through the parent folder
	folderKey := &openfgav1.CheckRequestTupleKey{
		User:     caller.GetUID(),
		Relation: zanzana.TranslateToFolderRelation(tupleKey.Relation, req.Resource),
		Object:   zanzana.NewScopedTupleEntry(zanzana.TypeFolder, req.Parent, "", strconv.FormatInt(ns.OrgID, 10)),
	}

	folderReq := &openfgav1.CheckRequest{
		TupleKey: folderKey,
	}

	folderRes, err := c.openfgaClient.Check(ctx, folderReq)
	if err != nil {
		return authzlib.CheckResponse{}, err
	}

	return authzlib.CheckResponse{Allowed: folderRes.Allowed}, nil
}

func (c *ZanzanaClient) List(ctx context.Context, caller claims.AuthInfo, req *zanzana.ListRequest) ([]string, error) {
	in := &openfgav1.ListObjectsRequest{
		Type:     req.Resource,
		User:     caller.GetUID(),
		Relation: req.Action,
	}
	res, err := c.openfgaClient.ListObjects(ctx, in)
	if err != nil {
		return nil, err
	}
	return res.Objects, err
}
