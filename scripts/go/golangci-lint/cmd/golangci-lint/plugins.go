package main

import (
	"github.com/golangci/plugin-module-register/register"
	"github.com/grafana/grafana/scripts/go/wirecheck"
)

func init() {
	register.Plugin("wirecheck", wirecheck.New)
}
