package v1beta1

import (
	folderapiv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// OpenAPIPrefix documents the v1beta1 kube-openapi model prefix; OpenAPI defs are shared with v1 (dashboard-style).
const OpenAPIPrefix = "com.github.grafana.grafana.apps.folder.pkg.apis.folder.v1beta1."

type (
	FolderInfoList   = folderapiv1.FolderInfoList
	FolderInfo       = folderapiv1.FolderInfo
	FolderAccessInfo = folderapiv1.FolderAccessInfo
	DescendantCounts = folderapiv1.DescendantCounts
	ResourceStats    = folderapiv1.ResourceStats
)

var UnstructuredToDescendantCounts = folderapiv1.UnstructuredToDescendantCounts
