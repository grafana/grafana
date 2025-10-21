package api

import (
	"net/http"
	"slices"
	"strings"

	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func (hs *HTTPServer) GetAlertNotifiers() func(*contextmodel.ReqContext) response.Response {
	return func(r *contextmodel.ReqContext) response.Response {
		v2 := notify.GetSchemaForAllIntegrations()
		if v2 == nil {
			return response.Error(http.StatusInternalServerError, "Failed to load alert notifier schemas", nil)
		}
		slices.SortFunc(v2, func(a, b schema.IntegrationTypeSchema) int {
			return strings.Compare(string(a.Type), string(b.Type))
		})
		if r.Query("version") == "2" {
			return response.JSON(http.StatusOK, v2)
		}

		type NotifierPlugin struct {
			Type        string         `json:"type"`
			TypeAlias   string         `json:"typeAlias,omitempty"`
			Name        string         `json:"name"`
			Heading     string         `json:"heading"`
			Description string         `json:"description"`
			Info        string         `json:"info"`
			Options     []schema.Field `json:"options"`
		}

		result := make([]*NotifierPlugin, 0, len(v2))
		for _, s := range v2 {
			v1, ok := s.GetVersion(schema.V1)
			if !ok {
				continue
			}
			result = append(result, &NotifierPlugin{
				Type:        string(s.Type),
				Name:        s.Name,
				Description: s.Description,
				Heading:     s.Heading,
				Info:        s.Info,
				Options:     v1.Options,
			})
		}
		return response.JSON(http.StatusOK, result)
	}
}
