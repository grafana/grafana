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

type mockConnection struct {
	searchResult     *ldap.SearchResult
	searchCalled     bool
	searchAttributes []string

	addParams *ldap.AddRequest
	addCalled bool

	delParams *ldap.DelRequest
	delCalled bool

	bindProvider                func(username, password string) error
	unauthenticatedBindProvider func(username string) error
}

func (c *mockConnection) Bind(username, password string) error {
	if c.bindProvider != nil {
		return c.bindProvider(username, password)
	}

	return nil
}

func (c *mockConnection) UnauthenticatedBind(username string) error {
	if c.unauthenticatedBindProvider != nil {
		return c.unauthenticatedBindProvider(username)
	}

	return nil
}

func (c *mockConnection) Close() {}

func (c *mockConnection) setSearchResult(result *ldap.SearchResult) {
	c.searchResult = result
}

func (c *mockConnection) Search(sr *ldap.SearchRequest) (*ldap.SearchResult, error) {
	c.searchCalled = true
	c.searchAttributes = sr.Attributes
	return c.searchResult, nil
}

func (c *mockConnection) Add(request *ldap.AddRequest) error {
	c.addCalled = true
	c.addParams = request
	return nil
}

func (c *mockConnection) Del(request *ldap.DelRequest) error {
	c.delCalled = true
	c.delParams = request
	return nil
}

func (c *mockConnection) StartTLS(*tls.Config) error {
	return nil
}

func authScenario(desc string, fn scenarioFunc) {
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
	loginUserQuery           *models.LoginUserQuery
	getUserByAuthInfoQuery   *models.GetUserByAuthInfoQuery
	getUserOrgListQuery      *models.GetUserOrgListQuery
	createUserCmd            *models.CreateUserCommand
	addOrgUserCmd            *models.AddOrgUserCommand
	updateOrgUserCmd         *models.UpdateOrgUserCommand
	removeOrgUserCmd         *models.RemoveOrgUserCommand
	updateUserCmd            *models.UpdateUserCommand
	setUsingOrgCmd           *models.SetUsingOrgCommand
	updateUserPermissionsCmd *models.UpdateUserPermissionsCommand
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

type scenarioFunc func(c *scenarioContext)
