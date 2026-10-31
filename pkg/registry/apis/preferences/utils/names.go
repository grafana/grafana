package utils

import (
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
)

// The owner naming helpers live in pkg/apimachinery/utils so they can be used
// outside the preferences API; these aliases keep existing callers unchanged.
type (
	ResourceOwner  = apiutils.ResourceOwner
	OwnerReference = apiutils.OwnerReference
)

const (
	NamespaceResourceOwner = apiutils.NamespaceResourceOwner
	UserResourceOwner      = apiutils.UserResourceOwner
	TeamResourceOwner      = apiutils.TeamResourceOwner
	UnknownResourceOwner   = apiutils.UnknownResourceOwner
)

var (
	ParseOwnerFromName = apiutils.ParseOwnerFromName
	UserOwner          = apiutils.UserOwner
	TeamOwner          = apiutils.TeamOwner
	NamespaceOwner     = apiutils.NamespaceOwner
)
