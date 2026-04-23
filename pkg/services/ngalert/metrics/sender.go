package metrics

import (
	"strconv"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

// Sender manages per-org metrics for the external Alertmanager sender.
// Each org gets its own prometheus.Registry. The Sender itself is registered
// as an unchecked collector on the parent registerer, delegating Collect to
// the per-org registries. Metrics are registered on org registries via
// WrapRegistererWith so that each metric carries an "org" const label.
type Sender struct {
	mu         sync.RWMutex
	registries map[int64]*prometheus.Registry
}

// NewSenderMetrics creates a new Sender and registers it as a collector on r.
func NewSenderMetrics(r prometheus.Registerer) *Sender {
	s := &Sender{
		registries: make(map[int64]*prometheus.Registry),
	}
	r.MustRegister(s)
	return s
}

// Describe is a no-op because org registries are created after this collector is registered.
func (s *Sender) Describe(chan<- *prometheus.Desc) {}

// Collect delegates to each per-org registry.
func (s *Sender) Collect(ch chan<- prometheus.Metric) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, reg := range s.registries {
		reg.Collect(ch)
	}
}

// GetOrCreateOrgRegistry returns a registerer for the given org.
// Metrics registered through it will carry an "org" const label.
func (s *Sender) GetOrCreateOrgRegistry(orgID int64) prometheus.Registerer {
	s.mu.Lock()
	defer s.mu.Unlock()
	reg, ok := s.registries[orgID]
	if !ok {
		reg = prometheus.NewRegistry()
		s.registries[orgID] = reg
	}
	return prometheus.WrapRegistererWith(
		prometheus.Labels{"org": strconv.FormatInt(orgID, 10)},
		reg,
	)
}

// RemoveOrgRegistry removes the registry for the given org.
func (s *Sender) RemoveOrgRegistry(orgID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.registries, orgID)
}
