package custom_personalization

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
)

var Log = log.New("bmc-custom-personalization-api")

type CustomDashPersonalizationDTO struct {
	Data *simplejson.Json `json:"data"`
}
