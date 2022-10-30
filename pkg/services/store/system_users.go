package store

import (
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

type SystemUserType string

const (
	ReportsReader SystemUserType = "ReportsReader"
	ReportsAdmin  SystemUserType = "ReportsAdmin"
)

type SystemUsersFilterProvider interface {
	GetFilter(user *user.SignedInUser) (map[string]filestorage.PathFilter, error)
}

type SystemUsersProvider interface {
	GetUser(userType SystemUserType, orgID int64) (*user.SignedInUser, error)
}

type SystemUsers interface {
	SystemUsersFilterProvider
	SystemUsersProvider
}

func ProvideSystemUsersService() SystemUsers {
	reportsReader := &user.SignedInUser{OrgID: ac.GlobalOrgID, Login: string(ReportsReader)}
	reportsAdmin := &user.SignedInUser{OrgID: ac.GlobalOrgID, Login: string(ReportsAdmin)}

	return &hardcodedSystemUsers{
		users: map[SystemUserType]map[int64]*user.SignedInUser{
			ReportsReader: {
				ac.GlobalOrgID: reportsReader,
			},
			ReportsAdmin: {
				ac.GlobalOrgID: reportsAdmin,
			},
		},
		createFilterByUser: map[*user.SignedInUser]func() map[string]filestorage.PathFilter{
			reportsReader: func() map[string]filestorage.PathFilter {
				return map[string]filestorage.PathFilter{
					ActionFilesRead:   createSystemReportsPathFilter(),
					ActionFilesWrite:  denyAllPathFilter,
					ActionFilesDelete: denyAllPathFilter,
				}
			},
			reportsAdmin: func() map[string]filestorage.PathFilter {
				systemReportsFilter := createSystemReportsPathFilter()
				return map[string]filestorage.PathFilter{
					ActionFilesRead:   systemReportsFilter,
					ActionFilesWrite:  systemReportsFilter,
					ActionFilesDelete: systemReportsFilter,
				}
			},
		},
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

func createSystemReportsPathFilter() filestorage.PathFilter {
	return filestorage.NewPathFilter(
		[]string{filestorage.Delimiter + reportsStorage + filestorage.Delimiter}, // access to all folders and files inside `/reports/`
		[]string{filestorage.Delimiter + reportsStorage},                         // access to the `/reports` folder itself, but not to any other sibling folder
		nil,
		nil)
}
