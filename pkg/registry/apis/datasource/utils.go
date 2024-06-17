package datasource

import (
	"errors"
	"runtime/debug"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
)

func panicGuard[R *backend.CheckHealthResult | *backend.QueryDataResponse | interface{}](logger log.Logger, f func() (R, error)) (res R, err error) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("panic recovered", "error", r, "stack", string(debug.Stack()))
			err = errors.New("internal server error")
			return
		}
	}()

	res, err = f()
	return
}
