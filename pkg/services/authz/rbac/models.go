package rbac

import claims "github.com/grafana/authlib/types"

type checkRequest struct {
	Namespace    claims.NamespaceInfo
	IdentityType claims.IdentityType
	UserUID      string
	Action       string // Verb has been mapped into an action
	Group        string
	Resource     string
	Verb         string
	Name         string
	ParentFolder string
}

type listRequest struct {
	Namespace    claims.NamespaceInfo
	IdentityType claims.IdentityType
	UserUID      string
	Group        string
	Resource     string
	Verb         string
	Action       string
}
