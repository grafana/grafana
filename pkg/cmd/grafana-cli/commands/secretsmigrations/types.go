package secretsmigrations

import "time"

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
