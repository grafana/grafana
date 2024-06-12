package authz

import (
	authzlib "github.com/grafana/authlib/authz"
)

const (
	EntityCreate = "create"
	EntityRead   = "read"
	EntityWrite  = "write"
	EntityDelete = "delete"
)

func toAction(kind, method string) string {
	return kind + ":" + method
}

func ToRBAC(kind, uid, folder, method string) (action string, scope authzlib.Resource) {
	// method = strings.ToLower(strings.TrimPrefix(method, "/entity.EntityStore/"))
	action = toAction(kind, method)

	if folder != "" {
		scope = authzlib.Resource{
			Kind: "folders",
			Attr: "uid",
			ID:   folder,
		}
	} else {
		// No scope for create outside of folder
		if method == EntityCreate {
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
