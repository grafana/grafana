package externalgroupmapping

import (
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/common"
)

type TeamGroupsHandler interface {
	rest.Storage
	rest.Scoper
	rest.StorageMetadata
	rest.Connecter
}

// TeamGroupsHandlerProvider builds the handler once the Team rest.Getter
// is ready (after dual-writer setup). OSS: noop; Enterprise overrides.
type TeamGroupsHandlerProvider func(teamGetter rest.Getter) TeamGroupsHandler

type SearchHandler interface {
	GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes
}
