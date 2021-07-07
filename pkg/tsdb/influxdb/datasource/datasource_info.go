package datasource

import (
	"net/http"
)

type Info struct {
	HTTPClient *http.Client
	Token      string
	Password   string

	Url           string `json:"url"`
	BasicAuth     bool   `json:"basicAuth"`
	User          string `json:"user"`
	Database      string `json:"database"`
	Version       string `json:"version"`
	HTTPMode      string `json:"httpMode"`
	TimeInterval  string `json:"timeInterval"`
	DefaultBucket string `json:"defaultBucket"`
	Organization  string `json:"organization"`
	MaxSeries     int    `json:"maxSeries"`
}
