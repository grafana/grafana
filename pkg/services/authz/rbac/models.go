package rbac

import claims "github.com/grafana/authlib/types"

type CheckRequest struct {
	Namespace    claims.NamespaceInfo
	IdentityType claims.IdentityType
	UserUID      string
	Action       string
	Group        string
	Resource     string
	Verb         string
	Name         string
	ParentFolder string
}

type ListRequest struct {
	Namespace    claims.NamespaceInfo
	IdentityType claims.IdentityType
	UserUID      string
	Group        string
	Resource     string
	Verb         string
	Action       string
}
