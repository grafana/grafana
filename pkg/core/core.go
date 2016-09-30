package core

import "context"

type GrafanaServer interface {
	context.Context
}

type GrafanaServerImpl struct {
}
