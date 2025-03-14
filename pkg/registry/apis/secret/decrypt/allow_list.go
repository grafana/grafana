package decrypt

import "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"

type decryptAllowList struct {
	allowList map[string]struct{}
}

var _ contracts.DecryptAllowList = (*decryptAllowList)(nil)

func ProvideDecryptAllowList() contracts.DecryptAllowList {
	return &decryptAllowList{make(map[string]struct{})}
}

func (d *decryptAllowList) AllowList() map[string]struct{} {
	return d.allowList
}
