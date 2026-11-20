package pluginproxy

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
)

var requestLogger = log.New("datasource.proxy")

type RequestLog struct {
	PluginID, DatasourceUID, Namespace string
	Method, Path                       string
	Status                             int
	Source                             string
	Duration                           time.Duration
}

func (r RequestLog) Log() {
	write := requestLogger.Info
	if r.Status >= 500 || r.Source == "client" || r.Source == string(requestmeta.StatusSourceDownstream) {
		write = requestLogger.Warn
	}
	// The query string can contain user queries. Keep only the bounded path.
	path := r.Path
	if i := strings.IndexAny(path, "?#"); i >= 0 {
		path = path[:i]
	}
	if r.PluginID == "" {
		r.PluginID = "unknown"
	}
	write("Proxied datasource request", "pluginId", r.PluginID, "datasourceUid", r.DatasourceUID,
		"namespace", r.Namespace, "method", r.Method, "path", path[:min(len(path), 200)],
		"status", r.Status, "statusSource", r.Source, "duration", r.Duration)
}
