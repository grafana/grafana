package rbac

import "github.com/grafana/authlib/claims"

type CheckRequest struct {
	Namespace    claims.NamespaceInfo
	UserUID      string
	Action       string
	Group        string
	Resource     string
	Verb         string
	Name         string
	ParentFolder string
}

type folderNode struct {
	uid          string
	parentUID    *string
	childrenUIDs []string
}
