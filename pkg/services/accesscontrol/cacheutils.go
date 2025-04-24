package accesscontrol

import (
	"bytes"
	"encoding/base64"
	"encoding/gob"
	"fmt"
	"hash/fnv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func (s *SearchOptions) HashString() (string, error) {
	if s == nil {
		return "", nil
	}
	var buf bytes.Buffer
	encoder := gob.NewEncoder(&buf)
	if err := encoder.Encode(s); err != nil {
		return "", err
	}
	h := fnv.New64a()
	_, err := h.Write(buf.Bytes())
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(h.Sum(nil)), nil
}

func GetUserPermissionCacheKey(user identity.Requester) string {
	return fmt.Sprintf("rbac-permissions-%s", user.GetCacheKey())
}

func GetSearchPermissionCacheKey(log log.Logger, user identity.Requester, searchOptions SearchOptions) (string, error) {
	searchHash, err := searchOptions.HashString()
	if err != nil {
		return "", err
	}
	key := fmt.Sprintf("rbac-permissions-%s-%s", user.GetCacheKey(), searchHash)
	return key, nil
}

func GetUserDirectPermissionCacheKey(user identity.Requester) string {
	return fmt.Sprintf("rbac-permissions-direct-%s", user.GetCacheKey())
}

func GetBasicRolePermissionCacheKey(role string, orgID int64) string {
	roleKey := strings.ReplaceAll(role, " ", "_")
	roleKey = strings.ToLower(roleKey)
	return fmt.Sprintf("rbac-permissions-basic-role-%d-%s", orgID, roleKey)
}

func GetTeamPermissionCacheKey(teamID int64, orgID int64) string {
	return fmt.Sprintf("rbac-permissions-team-%d-%d", orgID, teamID)
}
