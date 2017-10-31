package models

type GrafanaServer interface {
	Start()
	Shutdown(code int, reason string)
}
