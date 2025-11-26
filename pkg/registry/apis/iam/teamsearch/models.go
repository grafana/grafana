package teamsearch

import "k8s.io/apiserver/pkg/registry/rest"

type TeamSearchHandler interface {
	rest.Storage
	rest.Scoper
	rest.StorageMetadata
	rest.Connecter
}
