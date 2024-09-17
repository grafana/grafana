package extsvcauth

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	ErrUnknownProvider = errutil.BadRequest("extsvcauth.unknown-provider")
)
