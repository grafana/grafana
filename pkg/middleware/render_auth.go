package middleware

import (
	"sync"
	"time"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

var renderKeysLock sync.Mutex
var renderKeys map[string]*m.SignedInUser = make(map[string]*m.SignedInUser)

func initContextWithRenderAuth(ctx *m.ReqContext) bool {
	key := ctx.GetCookie("renderKey")
	if key == "" {
		return false
	}

	renderKeysLock.Lock()
	defer renderKeysLock.Unlock()

	renderUser, exists := renderKeys[key]
	if !exists {
		ctx.JsonApiErr(401, "Invalid Render Key", nil)
		return true
	}

	ctx.IsSignedIn = true
	ctx.SignedInUser = renderUser
	ctx.IsRenderCall = true
	ctx.LastSeenAt = time.Now()
	return true
}

func AddRenderAuthKey(orgId int64, userId int64, orgRole m.RoleType) string {
	renderKeysLock.Lock()

	key := util.GetRandomString(32)

	renderKeys[key] = &m.SignedInUser{
		OrgId:   orgId,
		OrgRole: orgRole,
		UserId:  userId,
	}

	renderKeysLock.Unlock()

	return key
}

func RemoveRenderAuthKey(key string) {
	renderKeysLock.Lock()
	delete(renderKeys, key)
	renderKeysLock.Unlock()
}
