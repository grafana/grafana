package api

import (
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/pkg/models"
)

type routeHandlerRegisterFn func(self *HttpServer)
type routeHandlerFn func(c *gin.Context, auth *authContext)

var routeHandlers = make([]routeHandlerRegisterFn, 0)

func getRouteHandlerWrapper(handler routeHandlerFn) gin.HandlerFunc {
	return func(c *gin.Context) {
		authContext := authContext{
			account:     c.MustGet("usingAccount").(*models.UserAccount),
			userAccount: c.MustGet("userAccount").(*models.UserAccount),
		}
		handler(c, &authContext)
	}
}

func (self *HttpServer) addRoute(method string, path string, handler routeHandlerFn) {
	switch method {
	case "GET":
		self.router.GET(path, self.auth(), getRouteHandlerWrapper(handler))
	case "POST":
		self.router.POST(path, self.auth(), getRouteHandlerWrapper(handler))
	case "DELETE":
		self.router.DELETE(path, self.auth(), getRouteHandlerWrapper(handler))
	}
}

func addRoutes(fn routeHandlerRegisterFn) {
	routeHandlers = append(routeHandlers, fn)
}
