package rbac

import "fmt"

func userPermCacheKey(namespace, userUID, action string) string {
	return fmt.Sprintf("%s_%s_%s", namespace, userUID, action)
}

func userBasicRoleCacheKey(namespace, userUID string) string {
	return fmt.Sprintf("%s_%s", namespace, userUID)
}

func userTeamCacheKey(namespace, userUID string) string {
	return fmt.Sprintf("%s_%s", namespace, userUID)
}
