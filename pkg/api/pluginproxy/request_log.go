package pluginproxy

import (
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

var requestLogger log.Logger = log.New("datasource.proxy")

type RequestLog struct {
	PluginID, DatasourceUID, Namespace string
	Method, Path                       string
	started                            time.Time
}

func (r *RequestLog) Start() {
	r.started = time.Now()
	requestLogger.Info("Plugin Request Started", r.fields()...)
}

func (r RequestLog) Complete(status int, source string) {
	write := requestLogger.Info
	if status >= http.StatusBadRequest {
		write = requestLogger.Error
	}
	fields := append(r.fields(), "status", status, "statusSource", source, "duration", time.Since(r.started))
	write("Plugin Request Completed", fields...)
}

func (r RequestLog) fields() []any {
	// The query string can contain user queries. Keep only the bounded path.
	path := r.Path
	if i := strings.IndexAny(path, "?#"); i >= 0 {
		path = path[:i]
	}
	if r.PluginID == "" {
		r.PluginID = "unknown"
	}
	return []any{"eventName", "grafana-data-egress", "pluginId", r.PluginID, "datasourceUid", r.DatasourceUID,
		"namespace", r.Namespace, "method", r.Method, "path", path[:min(len(path), 200)]}
}
