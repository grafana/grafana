package v1beta1

import (
	folderapiv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// OpenAPIPrefix is the kube-openapi model name prefix for types served as folder.grafana.app/v1beta1.
// Structurally identical types are aliases of v1; GetOpenAPIDefinitions remaps v1 model keys to this prefix.
const OpenAPIPrefix = "com.github.grafana.grafana.apps.folder.pkg.apis.folder.v1beta1."

type (
	FolderInfoList   = folderapiv1.FolderInfoList
	FolderInfo       = folderapiv1.FolderInfo
	FolderAccessInfo = folderapiv1.FolderAccessInfo
	DescendantCounts = folderapiv1.DescendantCounts
	ResourceStats    = folderapiv1.ResourceStats
)

var UnstructuredToDescendantCounts = folderapiv1.UnstructuredToDescendantCounts
