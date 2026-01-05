package externalgroupmapping

import "k8s.io/apiserver/pkg/registry/rest"

type TeamGroupsHandler interface {
	rest.Storage
	rest.Scoper
	rest.StorageMetadata
	rest.Connecter
}
