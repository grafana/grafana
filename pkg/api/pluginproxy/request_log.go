package pluginproxy

import (
	"context"
	"strings"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

var (
	requestLogger = log.New("datasource.proxy")
	sampleCount   atomic.Uint64
)

type RequestLog struct {
	PluginID, DatasourceUID, Namespace string
	Method, Path                       string
	Status                             int
	Source                             string
	Duration                           time.Duration
}

func StatusSource(ctx context.Context, status int) string {
	// The reverse proxy marks a client disconnect as downstream.
	if status == proxyutil.StatusClientClosedRequest {
		return "client"
	}
	if requestmeta.GetRequestMetaData(ctx).StatusSource == requestmeta.StatusSourceDownstream {
		return string(requestmeta.StatusSourceDownstream)
	}
	return string(requestmeta.StatusSourceServer)
}

func (r RequestLog) Log() {
	r.write(requestLogger, &sampleCount)
}

func (r RequestLog) write(logger log.Logger, count *atomic.Uint64) {
	failed := r.Status >= 500 || r.Source == "client" || r.Source == string(requestmeta.StatusSourceDownstream)
	if !failed && count.Add(1)%1000 != 0 {
		return
	}
	write := logger.Info
	if failed {
		write = logger.Warn
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
