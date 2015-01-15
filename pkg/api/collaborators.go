package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func AddCollaborator(c *middleware.Context) {
	var cmd m.AddCollaboratorCommand

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Invalid request", nil)
		return
	}

	userQuery := m.GetAccountByLoginQuery{Login: cmd.Email}
	err := bus.Dispatch(&userQuery)
	if err != nil {
		c.JsonApiErr(404, "Collaborator not found", nil)
		return
	}

	accountToAdd := userQuery.Result

	if accountToAdd.Id == c.UserAccount.Id {
		c.JsonApiErr(400, "Cannot add yourself as collaborator", nil)
		return
	}

	cmd.AccountId = c.UserAccount.Id
	cmd.CollaboratorId = accountToAdd.Id
	cmd.Role = m.ROLE_READ_WRITE

	err = bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Could not add collaborator", err)
		return
	}

	c.JsonOK("Collaborator added")
}

func GetCollaborators(c *middleware.Context) {
	query := m.GetCollaboratorsQuery{AccountId: c.UserAccount.Id}
	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get collaborators", err)
		return
	}

	c.JSON(200, query.Result)
}

func RemoveCollaborator(c *middleware.Context) {
	collaboratorId := c.ParamsInt64(":id")

	cmd := m.RemoveCollaboratorCommand{AccountId: c.UserAccount.Id, CollaboratorId: collaboratorId}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to remove collaborator", err)
	}

	c.JsonOK("Collaborator removed")
}
