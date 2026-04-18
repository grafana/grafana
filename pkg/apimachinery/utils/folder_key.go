package utils

import (
	"context"
)

type folderRemovePermissions string

const removePermissionKey = folderRemovePermissions("RemovePermission")

func SetFolderRemovePermissions(ctx context.Context, value bool) context.Context {
	return context.WithValue(ctx, removePermissionKey, value)
}

func GetFolderRemovePermissions(ctx context.Context, defaultVal bool) bool {
	if val, ok := ctx.Value(removePermissionKey).(bool); ok {
		return val
	}
	return defaultVal
}
