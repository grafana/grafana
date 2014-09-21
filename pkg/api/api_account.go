package api

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

func init() {
	addRoutes(func(self *HttpServer) {
		self.addRoute("POST", "/api/account/collaborators/add", self.addCollaborator)
		self.addRoute("POST", "/api/account/collaborators/remove", self.removeCollaborator)
		self.addRoute("GET", "/api/account/", self.getAccount)
		self.addRoute("GET", "/api/account/others", self.getOtherAccounts)
		self.addRoute("POST", "/api/account/using/:id", self.setUsingAccount)
	})
}

func (self *HttpServer) getAccount(c *gin.Context, auth *authContext) {
	var account = auth.userAccount

	model := accountInfoDto{
		Login:       account.Login,
		Email:       account.Email,
		AccountName: account.AccountName,
	}

	for _, collaborator := range account.Collaborators {
		model.Collaborators = append(model.Collaborators, &collaboratorInfoDto{
			AccountId: collaborator.AccountId,
			Role:      collaborator.Role,
			Email:     collaborator.Email,
		})
	}

	c.JSON(200, model)
}

func (self *HttpServer) getOtherAccounts(c *gin.Context, auth *authContext) {
	var account = auth.userAccount

	otherAccounts, err := self.store.GetOtherAccountsFor(account.Id)
	if err != nil {
		c.JSON(500, gin.H{"message": err.Error()})
		return
	}

	var result []*otherAccountDto
	result = append(result, &otherAccountDto{
		Id:      account.Id,
		Role:    "owner",
		IsUsing: account.Id == account.UsingAccountId,
		Name:    account.Email,
	})

	for _, other := range otherAccounts {
		result = append(result, &otherAccountDto{
			Id:      other.Id,
			Role:    other.Role,
			Name:    other.Name,
			IsUsing: other.Id == account.UsingAccountId,
		})
	}

	c.JSON(200, result)
}

func (self *HttpServer) addCollaborator(c *gin.Context, auth *authContext) {
	var model addCollaboratorDto

	if !c.EnsureBody(&model) {
		c.JSON(400, gin.H{"message": "Invalid request"})
		return
	}

	collaborator, err := self.store.GetAccountByLogin(model.Email)
	if err != nil {
		c.JSON(404, gin.H{"message": "Collaborator not found"})
		return
	}

	userAccount := auth.userAccount

	if collaborator.Id == userAccount.Id {
		c.JSON(400, gin.H{"message": "Cannot add yourself as collaborator"})
		return
	}

	err = userAccount.AddCollaborator(collaborator)
	if err != nil {
		c.JSON(400, gin.H{"message": err.Error()})
		return
	}

	err = self.store.UpdateAccount(userAccount)
	if err != nil {
		c.JSON(500, gin.H{"message": err.Error()})
		return
	}

	c.Abort(204)
}

func (self *HttpServer) removeCollaborator(c *gin.Context, auth *authContext) {
	var model removeCollaboratorDto
	if !c.EnsureBody(&model) {
		c.JSON(400, gin.H{"message": "Invalid request"})
		return
	}

	account := auth.userAccount
	account.RemoveCollaborator(model.AccountId)

	err := self.store.UpdateAccount(account)
	if err != nil {
		c.JSON(500, gin.H{"message": err.Error()})
		return
	}

	c.Abort(204)
}

func (self *HttpServer) setUsingAccount(c *gin.Context, auth *authContext) {
	idString := c.Params.ByName("id")
	id, _ := strconv.Atoi(idString)

	account := auth.userAccount
	otherAccount, err := self.store.GetAccount(id)
	if err != nil {
		c.JSON(500, gin.H{"message": err.Error()})
		return
	}

	if otherAccount.Id != account.Id && !otherAccount.HasCollaborator(account.Id) {
		c.Abort(401)
		return
	}

	account.UsingAccountId = otherAccount.Id
	err = self.store.UpdateAccount(account)
	if err != nil {
		c.JSON(500, gin.H{"message": err.Error()})
		return
	}

	c.Abort(204)
}
