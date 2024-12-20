package rbac

func userIdentifierCacheKey(namespace, userUID string) string {
	return "UID_" + namespace + "_" + userUID
}

func userIdentifierCacheKeyById(namespace, ID string) string {
	return "ID_" + namespace + "_" + ID
}

func anonymousPermCacheKey(namespace, action string) string {
	return namespace + "_anonymous_" + action
}

func userPermCacheKey(namespace, userUID, action string) string {
	return namespace + "_" + userUID + "_" + action
}

func userBasicRoleCacheKey(namespace, userUID string) string {
	return namespace + "_" + userUID
}

func userTeamCacheKey(namespace, userUID string) string {
	return namespace + "_" + userUID
}

func folderCacheKey(namespace string) string {
	return namespace
}
