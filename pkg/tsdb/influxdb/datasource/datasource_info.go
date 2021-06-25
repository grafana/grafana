package datasource

import (
	"net/http"

	"github.com/grafana/grafana/pkg/components/securejsondata"
)

type Info struct {
	HTTPClient *http.Client
	Token      string

	Url               string                        `json:"url"`
	BasicAuth         bool                          `json:"basicAuth"`
	BasicAuthUser     string                        `json:"basicAuthUser"`
	BasicAuthPassword string                        `json:"basicAuthPassword"`
	Password          string                        `json:"password"`
	User              string                        `json:"user"`
	Database          string                        `json:"database"`
	SecureJsonData    securejsondata.SecureJsonData `json:"secureJsonData"`
	Version           string                        `json:"version"`
	HTTPMode          string                        `json:"httpMode"`
	TimeInterval      string                        `json:"timeInterval"`
	DefaultBucket     string                        `json:"defaultBucket"`
	Organization      string                        `json:"organization"`
	MaxSeries         int                           `json:"maxSeries"`
}
