package metrics

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/web"
)

// OrgRegistries represents a map of registries per org.
type OrgRegistries struct {
	regsMu sync.Mutex
	regs   map[int64]prometheus.Registerer
}

func NewOrgRegistries() *OrgRegistries {
	return &OrgRegistries{
		regs: make(map[int64]prometheus.Registerer),
	}
}

// GetOrCreateOrgRegistry gets or creates a *prometheus.Registry for the specified org. It is safe to call concurrently.
func (m *OrgRegistries) GetOrCreateOrgRegistry(orgID int64) prometheus.Registerer {
	m.regsMu.Lock()
	defer m.regsMu.Unlock()

	orgRegistry, ok := m.regs[orgID]
	if !ok {
		reg := prometheus.NewRegistry()
		m.regs[orgID] = reg
		return reg
	}
	return orgRegistry
}

// RemoveOrgRegistry removes the *prometheus.Registry for the specified org. It is safe to call concurrently.
func (m *OrgRegistries) RemoveOrgRegistry(org int64) {
	m.regsMu.Lock()
	defer m.regsMu.Unlock()
	delete(m.regs, org)
}

// Instrument wraps a middleware, instrumenting the request latencies.
func Instrument(
	method,
	path string,
	action func(*contextmodel.ReqContext) response.Response,
	metrics *API,
) web.Handler {
	normalizedPath := MakeLabelValue(path)

	return func(c *contextmodel.ReqContext) {
		start := time.Now()
		res := action(c)

		// TODO: We could look up the datasource type via our datasource service
		var backend string
		datasourceID := web.Params(c.Req)[":DatasourceID"]
		if datasourceID == apimodels.GrafanaBackend.String() || datasourceID == "" {
			backend = GrafanaBackend
		} else {
			backend = ProxyBackend
		}

		ls := prometheus.Labels{
			"method":      method,
			"route":       normalizedPath,
			"status_code": fmt.Sprint(res.Status()),
			"backend":     backend,
		}
		res.WriteTo(c)
		metrics.RequestDuration.With(ls).Observe(time.Since(start).Seconds())
	}
}

var invalidChars = regexp.MustCompile(`[^a-zA-Z0-9]+`)

// MakeLabelValue normalizes a path template
func MakeLabelValue(path string) string {
	// Convert non-alnums to underscores.
	result := invalidChars.ReplaceAllString(path, "_")

	// Trim leading and trailing underscores.
	result = strings.Trim(result, "_")

	// Make it all lowercase
	result = strings.ToLower(result)

	// Special case.
	if result == "" {
		result = "root"
	}
	return result
}
