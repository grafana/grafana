package rbac

import "fmt"

func userIdentifierCacheKey(namespace, userUID string) string {
	return fmt.Sprintf("UID_%s_%s", namespace, userUID)
}

func userIdentifierCacheKeyById(namespace, ID string) string {
	return fmt.Sprintf("ID_%s_%s", namespace, ID)
}

func userPermCacheKey(namespace, userUID, action string) string {
	return fmt.Sprintf("%s_%s_%s", namespace, userUID, action)
}

func userBasicRoleCacheKey(namespace, userUID string) string {
	return fmt.Sprintf("%s_%s", namespace, userUID)
}

func userTeamCacheKey(namespace, userUID string) string {
	return fmt.Sprintf("%s_%s", namespace, userUID)
}
