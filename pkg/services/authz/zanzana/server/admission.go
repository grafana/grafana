package server

import (
	"sync"

	"golang.org/x/sync/semaphore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (s *Server) acquireSlot(method, namespace string) (release func(), err error) {
	var nl *semaphore.Weighted

	if s.globalSem != nil {
		if !s.globalSem.TryAcquire(1) {
			s.metrics.rejectedRequests.WithLabelValues(method, "global").Inc()
			return nil, status.Error(codes.ResourceExhausted, "server concurrency limit reached")
		}
		defer func() {
			if err != nil {
				s.globalSem.Release(1)
			}
		}()
	}

	if s.nsLimiterSize > 0 {
		nl = s.getOrCreateNamespaceLimiter(namespace)
		if !nl.TryAcquire(1) {
			s.metrics.rejectedRequests.WithLabelValues(method, "namespace").Inc()
			return nil, status.Error(codes.ResourceExhausted, "namespace concurrency limit reached")
		}
	}

	s.metrics.inflightRequests.WithLabelValues(method).Inc()

	var once sync.Once
	release = func() {
		once.Do(func() {
			s.metrics.inflightRequests.WithLabelValues(method).Dec()
			if nl != nil {
				nl.Release(1)
			}
			if s.globalSem != nil {
				s.globalSem.Release(1)
			}
		})
	}

	return release, nil
}

func (s *Server) getOrCreateNamespaceLimiter(namespace string) *semaphore.Weighted {
	if v, ok := s.namespaceLimiters.Load(namespace); ok {
		return v.(*semaphore.Weighted)
	}

	sem := semaphore.NewWeighted(s.nsLimiterSize)
	actual, _ := s.namespaceLimiters.LoadOrStore(namespace, sem)
	return actual.(*semaphore.Weighted)
}
