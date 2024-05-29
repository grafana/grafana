package authz

import (
	"strings"

	authzlib "github.com/grafana/authlib/authz"
)

func toAction(kind, method string) string {
	return kind + ":" + strings.ToLower(strings.TrimPrefix(method, "/entity.EntityStore/"))
}

func toRBAC(kind, uid, folder, method string) (action string, scope authzlib.Resource) {
	action = toAction(kind, method)

	if folder != "" {
		scope = authzlib.Resource{
			Kind: "folders",
			Attr: "uid",
			ID:   folder,
		}
	} else {
		// No scope for create outside of folder
		if method == "/entity.EntityStore/Create" {
			return
		}

		// TODO compute the attr part of the scope based no the kind
		scope = authzlib.Resource{
			Kind: "dashboards",
			Attr: "uid",
			ID:   uid,
		}
	}

	return
}
