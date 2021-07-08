package datasource

import (
	"net/http"
)

type Info struct {
	HTTPClient *http.Client
	Token      string

	Url           string `json:"url"`
	Database      string `json:"database"`
	Version       string `json:"version"`
	HTTPMode      string `json:"httpMode"`
	TimeInterval  string `json:"timeInterval"`
	DefaultBucket string `json:"defaultBucket"`
	Organization  string `json:"organization"`
	MaxSeries     int    `json:"maxSeries"`
}
