/*
 * Copyright (C) 2023-2025 BMC Helix Inc
 * Added by kmejdi at 12/20/2023
 */

package contextmodel

import (
	"fmt"
	"strings"
)

func (ctx *ReqContext) HasBHDPermission(resource string, action string) bool {
	if ctx.IsGrafanaAdmin {
		return true
	}
	// ctx.Rbac is a map of string:boolean. check if the key exists and the value is true
	permission := resource + ":" + action

	if bhdPermissions, ok := ctx.Permissions[ctx.OrgID]; ok && bhdPermissions != nil {
		if resources, ok := bhdPermissions[permission]; ok && resources != nil {
			return true
		}
	}
	return false
}

func (ctx *ReqContext) EvaluateIfHasAnyPermission(permissions []string) bool {
	if ctx.IsGrafanaAdmin {
		return true
	}
	for _, permission := range permissions {
		if bhdPermissions, ok := ctx.Permissions[ctx.OrgID]; ok && bhdPermissions != nil {
			if resources, ok := bhdPermissions[permission]; ok && resources != nil {
				return true
			}
		}
	}

	return false
}

func (ctx *ReqContext) HasAppPluginAccess(pluginId, pageId string) bool {
	if ctx.IsGrafanaAdmin {
		return true
	}

	// Ignore other app plugins
	if pluginId != "reports" {
		return true
	}

	// ctx.Rbac is a map of string:boolean. check if the key exists and the value is true
	permission := "reports:access"
	pageId = strings.ToLower(pageId)
	if pageId != "reports" {
		permission = fmt.Sprintf("reports.%s:read", pageId)
	}

	if bhdPermissions, ok := ctx.Permissions[ctx.OrgID]; ok && bhdPermissions != nil {
		if resources, ok := bhdPermissions[permission]; ok && resources != nil {
			return true
		}
	}

	// Fallback to roles
	if ctx.OrgRole == "Admin" {
		return true
	}

	if ctx.OrgRole == "Editor" && pageId == "reports" {
		return true
	}

	return false
}

func (ctx *ReqContext) HasBHDScopePermission(uid string, resource string, action string) bool {
	if ctx.IsGrafanaAdmin {
		return true
	}
	// ctx.Rbac is a map of string:boolean. check if the key exists and the value is true
	permission := fmt.Sprintf("%s:%s:%s", uid, resource, action)
	if bhdPermissions, ok := ctx.Permissions[ctx.OrgID]; ok && bhdPermissions != nil {
		if resources, ok := bhdPermissions[permission]; ok && resources != nil {
			return true
		}
	}
	return false
}
