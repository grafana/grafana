package api

import "github.com/gin-gonic/gin"

func init() {
	addRoutes(func(self *HttpServer) {
		self.router.GET("/login/*_", self.index)
		self.router.POST("/login", self.loginPost)
	})
}

type loginJsonModel struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	Remember bool   `json:"remember"`
}

func (self *HttpServer) loginPost(c *gin.Context) {
	var loginModel loginJsonModel

	if c.EnsureBody(&loginModel) {
		if loginModel.Email == "manu" && loginModel.Password == "123" {

			session, _ := sessionStore.Get(c.Request, "grafana-session")
			session.Values["login"] = true
			session.Save(c.Request, c.Writer)

			c.JSON(200, gin.H{"status": "you are logged in"})
		} else {
			c.JSON(401, gin.H{"status": "unauthorized"})
		}
	}
}

func (self *HttpServer) authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		session, _ := sessionStore.Get(c.Request, "grafana-session")

		if c.Request.URL.Path != "/login" && session.Values["login"] == nil {
			c.Writer.Header().Set("Location", "/login")
			c.Abort(302)
		}

		session.Save(c.Request, c.Writer)
	}
}
