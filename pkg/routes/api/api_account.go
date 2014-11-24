package api

import (
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/routes/dtos"
	"github.com/torkelo/grafana-pro/pkg/utils"
)

func GetAccount(c *middleware.Context) {
	model := dtos.AccountInfo{
		Name:  c.UserAccount.Name,
		Email: c.UserAccount.Email,
	}

	collaborators, err := models.GetCollaboratorsForAccount(c.UserAccount.Id)
	if err != nil {
		c.JsonApiErr(500, "Failed to fetch collaboratos", err)
		return
	}

	for _, collaborator := range collaborators {
		model.Collaborators = append(model.Collaborators, &dtos.Collaborator{
			AccountId: collaborator.AccountId,
			Role:      collaborator.Role,
			Email:     collaborator.Email,
		})
	}

	c.JSON(200, model)
}

func AddCollaborator(c *middleware.Context) {
	var model dtos.AddCollaboratorCommand

	if !c.JsonBody(&model) {
		c.JSON(400, utils.DynMap{"message": "Invalid request"})
		return
	}

	accountToAdd, err := models.GetAccountByLogin(model.Email)
	if err != nil {
		c.JsonApiErr(404, "Collaborator not found", nil)
		return
	}

	if accountToAdd.Id == c.UserAccount.Id {
		c.JsonApiErr(400, "Cannot add yourself as collaborator", nil)
		return
	}

	var collaborator = models.NewCollaborator(accountToAdd.Id, c.UserAccount.Id, models.ROLE_READ_WRITE)

	err = models.AddCollaborator(collaborator)
	if err != nil {
		c.JsonApiErr(500, "Could not add collaborator", err)
		return
	}

	c.Status(204)
}

func GetOtherAccounts(c *middleware.Context) {

	otherAccounts, err := models.GetOtherAccountsFor(c.UserAccount.Id)
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

// func SetUsingAccount(c *middleware.Context) {
// 	idString := c.Params.ByName("id")
// 	id, _ := strconv.Atoi(idString)
//
// 	account := auth.userAccount
// 	otherAccount, err := self.store.GetAccount(id)
// 	if err != nil {
// 		c.JSON(500, gin.H{"message": err.Error()})
// 		return
// 	}
//
// 	if otherAccount.Id != account.Id && !otherAccount.HasCollaborator(account.Id) {
// 		c.Abort(401)
// 		return
// 	}
//
// 	account.UsingAccountId = otherAccount.Id
// 	err = self.store.UpdateAccount(account)
// 	if err != nil {
// 		c.JSON(500, gin.H{"message": err.Error()})
// 		return
// 	}
//
// 	c.Abort(204)
// }
