package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"os"
)

func GetPerconaSaasHost(c *models.ReqContext) response.Response {
	saasHost := "https://portal.percona.com"
	envHost, ok := os.LookupEnv("PERCONA_PORTAL_URL")

	if ok {
		saasHost = envHost
	}

	return response.JSON(200, util.DynMap{
		"host": saasHost,
	})
}
