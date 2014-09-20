package api

import "github.com/gin-gonic/gin"

func init() {
	addRoutes(func(self *HttpServer) {
		self.addRoute("POST", "/api/account/collaborators/add", self.addCollaborator)
		self.addRoute("GET", "/api/account/", self.getAccount)
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
		})
	}

	c.JSON(200, model)
}

func (self *HttpServer) addCollaborator(c *gin.Context, auth *authContext) {
	var model addCollaboratorDto

	if !c.EnsureBody(&model) {
		c.JSON(400, gin.H{"status": "Collaborator not found"})
		return
	}

	collaborator, err := self.store.GetAccountByLogin(model.Email)
	if err != nil {
		c.JSON(404, gin.H{"status": "Collaborator not found"})
		return
	}

	userAccount := auth.userAccount

	if collaborator.Id == userAccount.Id {
		c.JSON(400, gin.H{"status": "Cannot add yourself as collaborator"})
		return
	}

	err = userAccount.AddCollaborator(collaborator.Id)
	if err != nil {
		c.JSON(400, gin.H{"status": err.Error()})
		return
	}

	err = self.store.UpdateAccount(userAccount)
	if err != nil {
		c.JSON(500, gin.H{"status": err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "Collaborator added"})
}
