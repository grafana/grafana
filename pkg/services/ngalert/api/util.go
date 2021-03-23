package api

import (
	"fmt"
	"regexp"
	"strconv"

	"github.com/go-openapi/strfmt"
	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var searchRegex = regexp.MustCompile(`\{(\w+)\}`)

func toMacaronPath(path string) string {
	return string(searchRegex.ReplaceAllFunc([]byte(path), func(s []byte) []byte {
		m := string(s[1 : len(s)-1])
		return []byte(fmt.Sprintf(":%s", m))
	}))
}

func timePtr(t strfmt.DateTime) *strfmt.DateTime {
	return &t
}

func stringPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}

func backendType(ctx *models.ReqContext, cache datasources.CacheService) (apimodels.Backend, error) {
	recipient := ctx.Params("Recipient")
	if recipient == apimodels.GrafanaBackend.String() {
		return apimodels.GrafanaBackend, nil
	}
	if datasourceID, err := strconv.ParseInt(recipient, 10, 64); err == nil {
		if ds, err := cache.GetDatasource(datasourceID, ctx.SignedInUser, ctx.SkipCache); err == nil {
			switch ds.Type {
			case "loki", "prometheus":
				return apimodels.LoTexRulerBackend, nil
			default:
				return 0, fmt.Errorf("unexpected backend type (%v)", ds.Type)
			}
		}
	}
	return 0, fmt.Errorf("unexpected backend type (%v)", recipient)
}
