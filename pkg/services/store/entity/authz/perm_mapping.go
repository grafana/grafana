package authz

import (
	"strings"

	authzlib "github.com/grafana/authlib/authz"
)

func toAction(kind, method string) string {
	return kind + ":" + method
}

func ToRBAC(kind, uid, folder, method string) (action string, scope authzlib.Resource) {
	method = strings.ToLower(strings.TrimPrefix(method, "/entity.EntityStore/"))

	action = toAction(kind, method)

	if folder != "" {
		scope = authzlib.Resource{
			Kind: "folders",
			Attr: "uid",
			ID:   folder,
		}
	} else {
		// No scope for create outside of folder
		if method == "create" {
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
