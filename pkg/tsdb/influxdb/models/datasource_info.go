package models

import (
	"net/http"
	"time"
)

type DatasourceInfo struct {
	HTTPClient *http.Client

	Token string
	URL   string

	DbName        string `json:"dbName"`
	Version       string `json:"version"`
	HTTPMode      string `json:"httpMode"`
	TimeInterval  string `json:"timeInterval"`
	DefaultBucket string `json:"defaultBucket"`
	Organization  string `json:"organization"`
	MaxSeries     int    `json:"maxSeries"`
	Timeout       time.Duration

	// FlightSQL grpc connection
	InsecureGrpc bool `json:"insecureGrpc"`
}
