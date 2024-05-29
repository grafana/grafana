package authz

import "strings"

func toAction(kind, method string) string {
	return kind + ":" + strings.ToLower(strings.TrimPrefix(method, "/entity.EntityStore/"))
}

func toRBAC(kind, uid, folder, method string) (action, scope string) {
	action = toAction(kind, method)

	if folder != "" {
		scope = "folders" + ":uid:" + folder
	} else {
		// No scope for create outside of folder
		if method == "/entity.EntityStore/Create" {
			return
		}

		// TODO compute the attr part of the scope based no the kind
		scope = kind + ":uid:" + uid
	}

	return
}
