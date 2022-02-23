package secretsmigrations

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

type simpleSecret struct {
	tableName  string
	columnName string
}

type b64Secret struct {
	simpleSecret
}

type jsonSecret struct {
	tableName string
}

type alertingSecret struct{}

func nowInUTC() string {
	return time.Now().UTC().Format("2006-01-02 15:04:05")
}

var logger = log.New("secrets.migrations")
