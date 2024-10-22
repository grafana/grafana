package server

import (
	"errors"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
)

var (
	errUnknownVerb     = errors.New("unknown verb")
	errUnknownResource = errors.New("unknown resource")
)

func translateToListRequest(r *authzextv1.ListRequest) (*openfgav1.ListObjectsRequest, error) {
	relation, ok := verbToRelationTranslations[r.GetVerb()]
	if !ok {
		return nil, errUnknownVerb
	}

	resourceType, ok := resourceToTypeTranslations[r.GetResource()]
	if !ok {
		return nil, errUnknownResource
	}

	user := r.GetSubject()

	fgaReq := &openfgav1.ListObjectsRequest{
		User:     user,
		Type:     resourceType,
		Relation: relation,
	}

	return fgaReq, nil
}

var resourceToTypeTranslations = map[string]string{
	"dashboards": "dashboards",
	"folders":    "folder",
}

var verbToRelationTranslations = map[string]string{
	"list":             "read",
	"get":              "read",
	"watch":            "read",
	"create":           "create",
	"update":           "write",
	"patch":            "write",
	"delete":           "delete",
	"deletecollection": "delete",
}
