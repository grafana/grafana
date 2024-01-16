// @PERCONA
package api

import (
	"os"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/util"
)

func GetPerconaSaasHost(c *contextmodel.ReqContext) response.Response {
	saasHost := "https://portal.percona.com"
	envHost, ok := os.LookupEnv("PERCONA_PORTAL_URL")

	if ok {
		saasHost = envHost
	}

	return response.JSON(200, util.DynMap{
		"host": saasHost,
	})
}
