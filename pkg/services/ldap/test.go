package ldap

import (
	"context"
	"crypto/tls"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/login"
)

// MockConnection struct for testing
type MockConnection struct {
	SearchResult     *ldap.SearchResult
	SearchCalled     bool
	SearchAttributes []string

	AddParams *ldap.AddRequest
	AddCalled bool

	DelParams *ldap.DelRequest
	DelCalled bool

	bindProvider                func(username, password string) error
	unauthenticatedBindProvider func(username string) error
}

// Bind mocks Bind connection function
func (c *MockConnection) Bind(username, password string) error {
	if c.bindProvider != nil {
		return c.bindProvider(username, password)
	}

	return nil
}

// UnauthenticatedBind mocks UnauthenticatedBind connection function
func (c *MockConnection) UnauthenticatedBind(username string) error {
	if c.unauthenticatedBindProvider != nil {
		return c.unauthenticatedBindProvider(username)
	}

	return nil
}

// Close mocks Close connection function
func (c *MockConnection) Close() {}

func (c *MockConnection) setSearchResult(result *ldap.SearchResult) {
	c.SearchResult = result
}

// Search mocks Search connection function
func (c *MockConnection) Search(sr *ldap.SearchRequest) (*ldap.SearchResult, error) {
	c.SearchCalled = true
	c.SearchAttributes = sr.Attributes
	return c.SearchResult, nil
}

// Add mocks Add connection function
func (c *MockConnection) Add(request *ldap.AddRequest) error {
	c.AddCalled = true
	c.AddParams = request
	return nil
}

// Del mocks Del connection function
func (c *MockConnection) Del(request *ldap.DelRequest) error {
	c.DelCalled = true
	c.DelParams = request
	return nil
}

// StartTLS mocks StartTLS connection function
func (c *MockConnection) StartTLS(*tls.Config) error {
	return nil
}

func serverScenario(desc string, fn scenarioFunc) {
	Convey(desc, func() {
		defer bus.ClearBusHandlers()

		sc := &scenarioContext{
			loginUserQuery: &models.LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
			},
		}

		loginService := &login.LoginService{
			Bus: bus.GetBus(),
		}

		bus.AddHandler("test", loginService.UpsertUser)

		bus.AddHandlerCtx("test", func(ctx context.Context, cmd *models.SyncTeamsCommand) error {
			return nil
		})

		bus.AddHandlerCtx("test", func(ctx context.Context, cmd *models.UpdateUserPermissionsCommand) error {
			sc.updateUserPermissionsCmd = cmd
			return nil
		})

		bus.AddHandler("test", func(cmd *models.GetUserByAuthInfoQuery) error {
			sc.getUserByAuthInfoQuery = cmd
			sc.getUserByAuthInfoQuery.Result = &models.User{Login: cmd.Login}
			return nil
		})

		bus.AddHandler("test", func(cmd *models.GetUserOrgListQuery) error {
			sc.getUserOrgListQuery = cmd
			return nil
		})

		bus.AddHandler("test", func(cmd *models.CreateUserCommand) error {
			sc.createUserCmd = cmd
			sc.createUserCmd.Result = models.User{Login: cmd.Login}
			return nil
		})

		bus.AddHandler("test", func(cmd *models.GetExternalUserInfoByLoginQuery) error {
			sc.getExternalUserInfoByLoginQuery = cmd
			sc.getExternalUserInfoByLoginQuery.Result = &models.ExternalUserInfo{UserId: 42, IsDisabled: false}
			return nil
		})

		bus.AddHandler("test", func(cmd *models.DisableUserCommand) error {
			sc.disableExternalUserCalled = true
			sc.disableUserCmd = cmd
			return nil
		})

		bus.AddHandler("test", func(cmd *models.AddOrgUserCommand) error {
			sc.addOrgUserCmd = cmd
			return nil
		})

		bus.AddHandler("test", func(cmd *models.UpdateOrgUserCommand) error {
			sc.updateOrgUserCmd = cmd
			return nil
		})

		bus.AddHandler("test", func(cmd *models.RemoveOrgUserCommand) error {
			sc.removeOrgUserCmd = cmd
			return nil
		})

		bus.AddHandler("test", func(cmd *models.UpdateUserCommand) error {
			sc.updateUserCmd = cmd
			return nil
		})

		bus.AddHandler("test", func(cmd *models.SetUsingOrgCommand) error {
			sc.setUsingOrgCmd = cmd
			return nil
		})

		fn(sc)
	})
}

type scenarioContext struct {
	loginUserQuery                  *models.LoginUserQuery
	getUserByAuthInfoQuery          *models.GetUserByAuthInfoQuery
	getExternalUserInfoByLoginQuery *models.GetExternalUserInfoByLoginQuery
	getUserOrgListQuery             *models.GetUserOrgListQuery
	createUserCmd                   *models.CreateUserCommand
	disableUserCmd                  *models.DisableUserCommand
	addOrgUserCmd                   *models.AddOrgUserCommand
	updateOrgUserCmd                *models.UpdateOrgUserCommand
	removeOrgUserCmd                *models.RemoveOrgUserCommand
	updateUserCmd                   *models.UpdateUserCommand
	setUsingOrgCmd                  *models.SetUsingOrgCommand
	updateUserPermissionsCmd        *models.UpdateUserPermissionsCommand
	disableExternalUserCalled       bool
}

func (sc *scenarioContext) userQueryReturns(user *models.User) {
	bus.AddHandler("test", func(query *models.GetUserByAuthInfoQuery) error {
		if user == nil {
			return models.ErrUserNotFound
		}
		query.Result = user
		return nil
	})
	bus.AddHandler("test", func(query *models.SetAuthInfoCommand) error {
		return nil
	})
}

func (sc *scenarioContext) userOrgsQueryReturns(orgs []*models.UserOrgDTO) {
	bus.AddHandler("test", func(query *models.GetUserOrgListQuery) error {
		query.Result = orgs
		return nil
	})
}

func (sc *scenarioContext) getExternalUserInfoByLoginQueryReturns(externalUser *models.ExternalUserInfo) {
	bus.AddHandler("test", func(cmd *models.GetExternalUserInfoByLoginQuery) error {
		sc.getExternalUserInfoByLoginQuery = cmd
		sc.getExternalUserInfoByLoginQuery.Result = &models.ExternalUserInfo{
			UserId:     externalUser.UserId,
			IsDisabled: externalUser.IsDisabled,
		}
		return nil
	})
}

type scenarioFunc func(c *scenarioContext)
