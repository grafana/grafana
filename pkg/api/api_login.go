package api

import "github.com/gin-gonic/gin"

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.GET("/login/*_", self.index)
		self.router.POST("/login", self.loginPost)
		self.router.POST("/logout", self.logoutPost)
	})
}

type loginJsonModel struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	Remember bool   `json:"remember"`
}

func (self *HttpServer) loginPost(c *gin.Context) {
	var loginModel loginJsonModel

	if !c.EnsureBody(&loginModel) {
		c.JSON(400, gin.H{"status": "bad request"})
		return
	}

	account, err := self.store.GetUserAccountLogin(loginModel.Email)
	if err != nil {
		c.JSON(400, gin.H{"status": "some error"})
	}

	if loginModel.Password != account.Password {
		c.JSON(401, gin.H{"status": "unauthorized"})
		return
	}

	session, _ := sessionStore.Get(c.Request, "grafana-session")
	session.Values["login"] = true
	session.Values["accountId"] = account.DatabaseId

	session.Save(c.Request, c.Writer)

	c.JSON(200, gin.H{"status": "you are logged in"})
}

func (self *HttpServer) logoutPost(c *gin.Context) {
	session, _ := sessionStore.Get(c.Request, "grafana-session")
	session.Values["login"] = nil
	session.Save(c.Request, c.Writer)

	c.JSON(200, gin.H{"status": "logged out"})
}

func (self *HttpServer) auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		session, _ := sessionStore.Get(c.Request, "grafana-session")

		if c.Request.URL.Path != "/login" && session.Values["login"] == nil {
			c.Writer.Header().Set("Location", "/login")
			c.Abort(302)
			return
		}

		c.Set("accountId", session.Values["accountId"])

		session.Save(c.Request, c.Writer)
	}
}
