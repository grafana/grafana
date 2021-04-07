package routing

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"gopkg.in/macaron.v1"
)

var (
	ServerError = func(err error) response.Response {
		return response.Error(500, "Server error", err)
	}
)

func Wrap(action interface{}) macaron.Handler {
	return func(c *models.ReqContext) {
		var res response.Response
		val, err := c.Invoke(action)
		if err == nil && val != nil && len(val) > 0 {
			res = val[0].Interface().(response.Response)
		} else {
			res = ServerError(err)
		}

		res.WriteTo(c)
	}
}
