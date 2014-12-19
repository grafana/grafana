package api

import (
	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/utils"
)

func GetAccount(c *middleware.Context) {
	query := m.GetAccountInfoQuery{Id: c.UserAccount.Id}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to fetch collaboratos", err)
		return
	}

	c.JSON(200, query.Result)
}

func AddCollaborator(c *middleware.Context) {
	var model dtos.AddCollaboratorCommand

	if !c.JsonBody(&model) {
		c.JsonApiErr(400, "Invalid request", nil)
		return
	}

	accountToAdd, err := m.GetAccountByLogin(model.Email)
	if err != nil {
		c.JsonApiErr(404, "Collaborator not found", nil)
		return
	}

	if accountToAdd.Id == c.UserAccount.Id {
		c.JsonApiErr(400, "Cannot add yourself as collaborator", nil)
		return
	}

	var collaborator = m.NewCollaborator(accountToAdd.Id, c.UserAccount.Id, m.ROLE_READ_WRITE)

	err = m.AddCollaborator(collaborator)
	if err != nil {
		c.JsonApiErr(500, "Could not add collaborator", err)
		return
	}

	c.Status(204)
}

func GetOtherAccounts(c *middleware.Context) {

	otherAccounts, err := m.GetOtherAccountsFor(c.UserAccount.Id)
	if err != nil {
		c.JSON(500, utils.DynMap{"message": err.Error()})
		return
	}

	var result []*dtos.OtherAccount
	result = append(result, &dtos.OtherAccount{
		Id:      c.UserAccount.Id,
		Role:    "owner",
		IsUsing: c.UserAccount.Id == c.UserAccount.UsingAccountId,
		Name:    c.UserAccount.Email,
	})

	for _, other := range otherAccounts {
		result = append(result, &dtos.OtherAccount{
			Id:      other.Id,
			Role:    other.Role,
			Name:    other.Email,
			IsUsing: other.Id == c.UserAccount.UsingAccountId,
		})
	}

	c.JSON(200, result)
}

func SetUsingAccount(c *middleware.Context) {
	usingAccountId := c.ParamsInt64(":id")

	account := c.UserAccount
	otherAccounts, err := m.GetOtherAccountsFor(c.UserAccount.Id)

	if err != nil {
		c.JSON(500, utils.DynMap{"message": err.Error()})
		return
	}

	// validate that the account id in the list
	valid := false
	for _, other := range otherAccounts {
		if other.Id == usingAccountId {
			valid = true
		}
	}

	if !valid {
		c.Status(401)
		return
	}

	account.UsingAccountId = usingAccountId
	err = m.SaveAccount(account)
	if err != nil {
		c.JSON(500, utils.DynMap{"message": err.Error()})
		return
	}

	c.Status(204)
}
