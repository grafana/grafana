package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

func SetUserPermissions(orgID int64, permissions []*Permission, user *models.SignedInUser) {
	if user.Permissions == nil {
		user.Permissions = make(map[int64]interface{}, 1)
	}
	user.Permissions[orgID] = permissions
}

func GetUserPermissions(orgID int64, user *models.SignedInUser) ([]*Permission, bool) {
	if user.Permissions == nil {
		user.Permissions = make(map[int64]interface{}, 1)
	}
	permissions, ok := user.Permissions[orgID].([]*Permission)
	if ok {
		fmt.Println("Get permissions from request cache")
		return permissions, true
	}
	fmt.Println("not ok")
	return nil, false
}
