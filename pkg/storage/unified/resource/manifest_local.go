package resource

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/infra/log"
)

// A local lookup costs a map read, so answers can be re-checked far more often
// than over the network; this keeps a plugin installed at runtime from waiting
// minutes to get its search fields.
const (
	localManifestMaxAge        = 10 * time.Second
	localManifestRetryInterval = 5 * time.Second
)

// GroupManifestSource returns the AppManifest a group is served with.
type GroupManifestSource interface {
	// GroupManifest returns the manifest for group and a version that changes
	// whenever the manifest does. ok is false when nothing serves a manifest for
	// the group. It returns ErrManifestSourceNotReady until it can answer.
	// Callers must not modify the manifest.
	GroupManifest(group string) (manifest *app.ManifestData, version string, ok bool, err error)
}

// LocalManifestSource connects in-process storage to the router running in
// the same process. The router's loader depends on storage, so the router
// can't be handed to storage when storage is built; it registers itself here
// once it exists, and until then every lookup is not ready.
type LocalManifestSource struct {
	mu  sync.RWMutex
	src GroupManifestSource
}

func ProvideLocalManifestSource() *LocalManifestSource {
	return &LocalManifestSource{}
}

// Set registers the source lookups are answered from. Nil-safe, so a caller
// that has nowhere to register can pass a nil LocalManifestSource.
func (l *LocalManifestSource) Set(src GroupManifestSource) {
	if l == nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.src = src
}

func (l *LocalManifestSource) source() GroupManifestSource {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.src
}

// fetch answers the way the router does over HTTP, with the version as the
// ETag, so the resolver treats both the same.
func (l *LocalManifestSource) fetch(_ context.Context, group, etag string) (manifestResponse, error) {
	src := l.source()
	if src == nil {
		return manifestResponse{}, ErrManifestSourceNotReady
	}
	m, version, ok, err := src.GroupManifest(group)
	switch {
	case err != nil:
		return manifestResponse{}, err
	case !ok:
		return manifestResponse{status: http.StatusNotFound}, nil
	case etag != "" && etag == version:
		return manifestResponse{status: http.StatusNotModified}, nil
	default:
		return manifestResponse{status: http.StatusOK, etag: version, manifest: m}, nil
	}
}

// NewLocalManifestResolver creates a ManifestResolver that reads from the
// router in this process instead of calling one over the network.
func NewLocalManifestResolver(local *LocalManifestSource, reg prometheus.Registerer, builtin []*app.ManifestData, apply func([]*app.ManifestData) error) *ManifestResolver {
	r := newManifestResolver(local, builtin, apply, log.New("search-manifest-resolver"))
	r.metrics = newManifestResolverMetrics(reg)
	r.missTTL = localManifestMaxAge
	r.maxAge = localManifestMaxAge
	r.retryInterval = localManifestRetryInterval
	return r
}
