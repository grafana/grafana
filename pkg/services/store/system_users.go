package store

import (
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

type SystemUserType string

// SystemUsersFilterProvider interface internal to `pkg/store` service.
// Used by the Storage service to retrieve path filter for system users
type SystemUsersFilterProvider interface {
	GetFilter(user *user.SignedInUser) (map[string]filestorage.PathFilter, error)
}

// SystemUsersProvider interface used by `pkg/store` clients
// Used by Grafana services to retrieve users having access only to their own slice of storage
// For example, service 'Dashboard' could have exclusive access to paths matching `system/dashboard/*`
// by creating a system user with appropriate permissions.
type SystemUsersProvider interface {
	GetUser(userType SystemUserType, orgID int64) (*user.SignedInUser, error)
}

//go:generate mockery --name SystemUsers --structname FakeSystemUsers --inpackage --filename system_users_mock.go
type SystemUsers interface {
	SystemUsersFilterProvider
	SystemUsersProvider

	// RegisterUser extension point - allows other Grafana services to register their own user type and assign them path-based permissions
	RegisterUser(userType SystemUserType, filterFn func() map[string]filestorage.PathFilter)
}

func ProvideSystemUsersService() SystemUsers {
	return &hardcodedSystemUsers{
		mutex:              sync.RWMutex{},
		users:              make(map[SystemUserType]map[int64]*user.SignedInUser),
		createFilterByUser: make(map[*user.SignedInUser]func() map[string]filestorage.PathFilter),
	}
}

type hardcodedSystemUsers struct {
	mutex sync.RWMutex

	// map of user type ->  map of user per orgID
	users map[SystemUserType]map[int64]*user.SignedInUser

	// map of user -> create filter function. all users of the same type will point to the same function
	createFilterByUser map[*user.SignedInUser]func() map[string]filestorage.PathFilter
}

func (h *hardcodedSystemUsers) GetFilter(user *user.SignedInUser) (map[string]filestorage.PathFilter, error) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	createFn, ok := h.createFilterByUser[user]
	if !ok {
		return nil, fmt.Errorf("user %s with id %d has not been initialized", user.Login, user.UserID)
	}

	return createFn(), nil
}

func (h *hardcodedSystemUsers) GetUser(userType SystemUserType, orgID int64) (*user.SignedInUser, error) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	userPerOrgIdMap, ok := h.users[userType]
	if !ok {
		return nil, fmt.Errorf("user type %s is unknown", userType)
	}

	orgSignedInUser, ok := userPerOrgIdMap[orgID]
	if ok {
		return orgSignedInUser, nil
	}

	// user for the given org does not yet exist - initialize it

	globalUser, globalUserExists := userPerOrgIdMap[ac.GlobalOrgID]
	if !globalUserExists {
		return nil, fmt.Errorf("initialization error: user type %s should exist for global org id: %d", userType, ac.GlobalOrgID)
	}

	globalUserFn, globalUserFnExists := h.createFilterByUser[globalUser]
	if !globalUserFnExists {
		return nil, fmt.Errorf("initialization error: user type %s should be associated with a create filter function", userType)
	}

	newUser := &user.SignedInUser{
		Login: string(userType),
		OrgID: orgID,
	}
	userPerOrgIdMap[orgID] = newUser
	h.createFilterByUser[newUser] = globalUserFn
	return newUser, nil
}

func (h *hardcodedSystemUsers) RegisterUser(userType SystemUserType, filterFn func() map[string]filestorage.PathFilter) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	globalUser := &user.SignedInUser{OrgID: ac.GlobalOrgID, Login: string(userType)}
	h.users[userType] = map[int64]*user.SignedInUser{ac.GlobalOrgID: globalUser}

	h.createFilterByUser[globalUser] = filterFn
}
