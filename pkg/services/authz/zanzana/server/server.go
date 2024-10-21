package server

import (
	"fmt"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
)

const (
	// FIXME: the open fga api requires that the store id is 26 characters long.
	storeID = "11111111111111111111111111"
	// FIXME: the open fga api requires that the model id is 26 characters long.
	modelID = "11111111111111111111111111"
)

var _ authzv1.AuthzServiceServer = (*Server)(nil)
var _ authzextv1.AuthzExtentionServiceServer = (*Server)(nil)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/authz/zanzana/server")

func NewAuthz(openfga openfgav1.OpenFGAServiceServer) *Server {
	return &Server{openfga: openfga}
}

type Server struct {
	authzv1.UnimplementedAuthzServiceServer
	authzextv1.UnimplementedAuthzExtentionServiceServer

	openfga openfgav1.OpenFGAServiceServer
}

func newTypedIdent(typ string, name string) string {
	return fmt.Sprintf("%s:%s", typ, name)
}

func newGroupResourceIdent(group, resource string) string {
	return fmt.Sprintf("group_resource:%s/%s", group, resource)
}

func newResourceIdent(group, resource, name string) string {
	return fmt.Sprintf("resource:%s/%s/%s", group, resource, name)
}

type TypeInfo struct {
	typ string
}

var typedResources = map[string]TypeInfo{
	newGroupResourceIdent(folderalpha1.GROUP, folderalpha1.RESOURCE): TypeInfo{typ: "folder2"},
}

func typeInfo(group, resource string) (TypeInfo, bool) {
	info, ok := typedResources[newGroupResourceIdent(group, resource)]
	return info, ok
}

var mapping = map[string]string{
	utils.VerbGet:              "read",
	utils.VerbList:             "read",
	utils.VerbWatch:            "read",
	utils.VerbCreate:           "create",
	utils.VerbUpdate:           "write",
	utils.VerbPatch:            "write",
	utils.VerbDelete:           "delete",
	utils.VerbDeleteCollection: "delete",
}
