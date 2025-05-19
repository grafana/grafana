package decrypt

import "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"

// TEMPORARY
func ProvideDecryptAllowList() contracts.DecryptAllowList {
	return make(map[string]struct{}, 0)
}
