package iam

import "github.com/grafana/grafana/pkg/services/apiserver/builder"

type APIExtender interface {
	GetAPIRoutes() *builder.APIRoutes
}

type NoOpExtender struct{}

func (*NoOpExtender) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func ProvideNoOpExtender() APIExtender {
	return &NoOpExtender{}
}
