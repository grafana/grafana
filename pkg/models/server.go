package models

import "context"

type GrafanaServer interface {
	context.Context

	Start()
	Shutdown(code int, reason string)
}
