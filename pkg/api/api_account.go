package api

import "github.com/gin-gonic/gin"

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.POST("/api/account/collaborators/add", self.auth(), self.addCollaborator)
	})
}

type addCollaboratorDto struct {
	Email string `json:"email" binding:"required"`
}

func (self *HttpServer) addCollaborator(c *gin.Context) {
	var model addCollaboratorDto

	if !c.EnsureBody(&model) {
		c.JSON(400, gin.H{"status": "bad request"})
		return
	}

	accountId, _ := c.Get("accountId")
	account, err := self.store.GetAccount(accountId.(int))
	if err != nil {
		c.JSON(401, gin.H{"status": "Authentication error"})
	}

	collaborator, err := self.store.GetUserAccountLogin(model.Email)
	if err != nil {
		c.JSON(404, gin.H{"status": "Collaborator not found"})
	}

	account.AddCollaborator(collaborator.Id)

	self.store.SaveUserAccount(account)

	c.JSON(200, gin.H{"status": "Collaborator added"})
}
