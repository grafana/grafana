package client

import (
	"context"
	"strconv"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
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
	key := &openfgav1.CheckRequestTupleKey{
		User:     req.User,
		Relation: req.Relation,
		Object:   req.Object,
	}

	in := &openfgav1.CheckRequest{
		TupleKey: key,
	}

	// Check direct access to resource first
	res, err := a.zclient.Check(ctx, in)
	if err != nil {
		return false, err
	}

	// no need to check folder access
	if res.Allowed || req.Parent == "" {
		return res.Allowed, nil
	}

	// Check access through the parent folder
	ns, err := claims.ParseNamespace(req.Namespace)
	if err != nil {
		return false, err
	}

	folderKey := &openfgav1.CheckRequestTupleKey{
		User:     req.User,
		Relation: zanzana.TranslateToFolderRelation(req.Relation, req.ObjectType),
		Object:   zanzana.NewScopedTupleEntry(zanzana.TypeFolder, req.Parent, "", strconv.FormatInt(ns.OrgID, 10)),
	}

	folderReq := &openfgav1.CheckRequest{
		TupleKey: folderKey,
	}

	folderRes, err := a.zclient.Check(ctx, folderReq)
	if err != nil {
		return false, err
	}

	return folderRes.Allowed, nil
}

func (c *ZanzanaClient) List(ctx context.Context, caller claims.AuthInfo, req *zanzana.ListRequest) ([]string, error) {
	in := &openfgav1.ListObjectsRequest{
		Type:     req.Type,
		User:     req.User,
		Relation: req.Relation,
	}
	res, err := a.zclient.ListObjects(ctx, in)
	if err != nil {
		return nil, err
	}
	return res.Objects, err
}
