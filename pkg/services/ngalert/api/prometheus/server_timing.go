package api

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	gojson "github.com/goccy/go-json"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

// ServerTiming represents a single server timing metric for the Server-Timing API
// See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing
type ServerTiming struct {
	Name        string  // Metric name (e.g., "db", "cache", "api")
	Duration    float64 // Duration in milliseconds
	Description string  // Optional description
}

// ServerTimingCollector helps collect timing metrics throughout request processing
// It's thread-safe and can be used from multiple goroutines
type ServerTimingCollector struct {
	mu      sync.Mutex
	timings []ServerTiming
	starts  map[string]time.Time

	// Track absolute start time to measure true total including JSON encoding
	requestStartTime time.Time

	// Metrics for database operations
	dbQueryCount    int64
	dbQueryDuration time.Duration

	// Metrics for cache operations
	cacheHits           int64
	cacheMisses         int64
	cacheLookupDuration time.Duration

	// Metrics for state manager operations
	stateManagerQueryCount    int64
	stateManagerQueryDuration time.Duration
}

// NewServerTimingCollector creates a new timing collector
func NewServerTimingCollector() *ServerTimingCollector {
	return &ServerTimingCollector{
		timings:          make([]ServerTiming, 0),
		starts:           make(map[string]time.Time),
		requestStartTime: time.Now(), // Capture start time immediately
	}
}

// Start begins timing a named operation
func (c *ServerTimingCollector) Start(name string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.starts[name] = time.Now()
}

// End finishes timing a named operation and records it
func (c *ServerTimingCollector) End(name, description string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if start, ok := c.starts[name]; ok {
		duration := float64(time.Since(start).Microseconds()) / 1000.0 // Convert to milliseconds
		c.timings = append(c.timings, ServerTiming{
			Name:        name,
			Duration:    duration,
			Description: description,
		})
		delete(c.starts, name)
	}
}

// Add adds a pre-calculated timing metric (thread-safe)
func (c *ServerTimingCollector) Add(timing ServerTiming) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.timings = append(c.timings, timing)
}

// AddMultiple adds multiple timing metrics at once (thread-safe)
func (c *ServerTimingCollector) AddMultiple(timings []ServerTiming) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.timings = append(c.timings, timings...)
}

// RecordDBQuery records a database query execution
func (c *ServerTimingCollector) RecordDBQuery(duration time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.dbQueryCount++
	c.dbQueryDuration += duration
}

// RecordCacheHit records a cache hit
func (c *ServerTimingCollector) RecordCacheHit(duration time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cacheHits++
	c.cacheLookupDuration += duration
}

// RecordCacheMiss records a cache miss
func (c *ServerTimingCollector) RecordCacheMiss(duration time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cacheMisses++
	c.cacheLookupDuration += duration
}

// RecordStateManagerQuery records a state manager query
func (c *ServerTimingCollector) RecordStateManagerQuery(duration time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stateManagerQueryCount++
	c.stateManagerQueryDuration += duration
}

// HasCacheHits returns true if any cache hits were recorded
func (c *ServerTimingCollector) HasCacheHits() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cacheHits > 0
}

// HasCacheMisses returns true if any cache misses were recorded
func (c *ServerTimingCollector) HasCacheMisses() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.cacheMisses > 0
}

// HasDBQueries returns true if any database queries were recorded
func (c *ServerTimingCollector) HasDBQueries() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.dbQueryCount > 0
}

// GetTimings returns all collected timings, including computed metrics
func (c *ServerTimingCollector) GetTimings() []ServerTiming {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Create a copy of timings and add computed metrics
	result := make([]ServerTiming, len(c.timings))
	copy(result, c.timings)

	// Add database metrics if any queries were executed
	if c.dbQueryCount > 0 {
		result = append(result, ServerTiming{
			Name:        "db",
			Duration:    float64(c.dbQueryDuration.Microseconds()) / 1000.0,
			Description: fmt.Sprintf("%d queries", c.dbQueryCount),
		})
	}

	// Add cache metrics if any lookups were performed
	if c.cacheHits > 0 || c.cacheMisses > 0 {
		totalLookups := c.cacheHits + c.cacheMisses
		hitRate := float64(c.cacheHits) / float64(totalLookups) * 100.0
		result = append(result, ServerTiming{
			Name:        "cache",
			Duration:    float64(c.cacheLookupDuration.Microseconds()) / 1000.0,
			Description: fmt.Sprintf("%d hits, %d misses (%.1f%% hit rate)", c.cacheHits, c.cacheMisses, hitRate),
		})
	}

	// Add state manager metrics if any queries were performed
	if c.stateManagerQueryCount > 0 {
		result = append(result, ServerTiming{
			Name:        "state_mgr",
			Duration:    float64(c.stateManagerQueryDuration.Microseconds()) / 1000.0,
			Description: fmt.Sprintf("%d state queries", c.stateManagerQueryCount),
		})
	}

	return result
}

// Context key for passing ServerTimingCollector through context
// Using string to avoid type mismatch across packages
const serverTimingCollectorKey = "grafana.server-timing-collector"

// ContextWithTimingCollector returns a new context with the timing collector attached
func ContextWithTimingCollector(ctx context.Context, collector *ServerTimingCollector) context.Context {
	return context.WithValue(ctx, serverTimingCollectorKey, collector)
}

// TimingCollectorFromContext extracts the timing collector from context
// Returns nil if not present (allows graceful degradation)
func TimingCollectorFromContext(ctx context.Context) *ServerTimingCollector {
	if collector, ok := ctx.Value(serverTimingCollectorKey).(*ServerTimingCollector); ok {
		return collector
	}
	return nil
}

// GoJsonResponseWithTiming is a response type that supports both fast JSON encoding
// and Server-Timing API headers for performance monitoring
type GoJsonResponseWithTiming struct {
	status         int
	body           any
	timings        []ServerTiming
	preencodedJSON []byte // Cached pre-encoded JSON to avoid double encoding
}

// Status returns the HTTP status code
func (r *GoJsonResponseWithTiming) Status() int {
	return r.status
}

// Body returns nil as this is a streaming response
func (r *GoJsonResponseWithTiming) Body() []byte {
	return nil
}

// WriteTo writes the JSON response and Server-Timing headers
func (r *GoJsonResponseWithTiming) WriteTo(ctx *contextmodel.ReqContext) {
	ctx.Resp.Header().Set("Content-Type", "application/json; charset=utf-8")
	ctx.Resp.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	// Build Server-Timing header - we'll update it after JSON encoding
	// by replacing the 'total' metric with actual total including encoding
	var timingParts []string
	if len(r.timings) > 0 {
		for _, timing := range r.timings {
			part := fmt.Sprintf("%s;dur=%.2f", timing.Name, timing.Duration)
			if timing.Description != "" {
				// Escape quotes in description for HTTP header
				desc := strings.ReplaceAll(timing.Description, "\"", "\\\"")
				part += fmt.Sprintf(";desc=\"%s\"", desc)
			}
			timingParts = append(timingParts, part)
		}
		// Set standard Server-Timing header
		timingHeader := strings.Join(timingParts, ", ")
		ctx.Resp.Header().Set("Server-Timing", timingHeader)
		// Also set custom header that Cloudflare won't strip
		ctx.Resp.Header().Set("X-Grafana-Timing", timingHeader)
	}

	ctx.Resp.WriteHeader(r.status)

	// Use pre-encoded JSON if available (from timing measurement), otherwise encode now
	if r.preencodedJSON != nil {
		// Write pre-encoded bytes directly - this is nearly instant
		if _, err := ctx.Resp.Write(r.preencodedJSON); err != nil {
			ctx.Logger.Error("Error writing pre-encoded JSON", "err", err)
		}
	} else {
		// Fallback to encoding on-the-fly if pre-encoding wasn't done
		enc := gojson.NewEncoder(ctx.Resp)
		if err := enc.Encode(r.body); err != nil {
			ctx.Logger.Error("Error encoding JSON with goccy/go-json", "err", err)
		}
	}
}

// NewGoJsonResponseWithTiming creates a new response with Server-Timing support
func NewGoJsonResponseWithTiming(status int, body any, timings []ServerTiming) response.Response {
	return &GoJsonResponseWithTiming{
		status:  status,
		body:    body,
		timings: timings,
	}
}

// NewGoJsonResponseWithTimingAndPreencoded creates a response with pre-encoded JSON
// This avoids double-encoding when JSON was pre-encoded for timing measurement
func NewGoJsonResponseWithTimingAndPreencoded(status int, body any, preencodedJSON []byte, timings []ServerTiming) response.Response {
	return &GoJsonResponseWithTiming{
		status:         status,
		body:           body,
		preencodedJSON: preencodedJSON,
		timings:        timings,
	}
}
