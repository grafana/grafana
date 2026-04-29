package pipeline

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/live/pipeline/tree"
)

// CacheSegmentedTree provides a fast access to channel rule configuration.
type CacheSegmentedTree struct {
	radixMu     sync.RWMutex
	radix       map[string]*tree.Node
	ruleBuilder RuleBuilder
}

func NewCacheSegmentedTree(storage RuleBuilder) *CacheSegmentedTree {
	s := &CacheSegmentedTree{
		radix:       map[string]*tree.Node{},
		ruleBuilder: storage,
	}
	go s.updatePeriodically()
	return s
}

func (s *CacheSegmentedTree) updatePeriodically() {
	for {
		s.radixMu.Lock()
		namespaces := make([]string, 0, len(s.radix))
		for v := range s.radix {
			namespaces = append(namespaces, v)
		}
		s.radixMu.Unlock()
		for _, v := range namespaces {
			err := s.fillOrg(v)
			if err != nil {
				logger.Error("Error filling orgId", "error", err, "ns", v)
			}
		}
		time.Sleep(20 * time.Second)
	}
}

func (s *CacheSegmentedTree) fillOrg(ns string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	channels, err := s.ruleBuilder.BuildRules(ctx, ns)
	if err != nil {
		return err
	}
	s.radixMu.Lock()
	defer s.radixMu.Unlock()
	s.radix[ns] = tree.New()
	for _, ch := range channels {
		s.radix[ns].AddRoute("/"+ch.Pattern, ch)
	}
	return nil
}

func (s *CacheSegmentedTree) Get(ns string, channel string) (*LiveChannelRule, bool, error) {
	s.radixMu.RLock()
	_, ok := s.radix[ns]
	s.radixMu.RUnlock()
	if !ok {
		err := s.fillOrg(ns)
		if err != nil {
			return nil, false, fmt.Errorf("error filling org: %w", err)
		}
	}
	s.radixMu.RLock()
	defer s.radixMu.RUnlock()
	t, ok := s.radix[ns]
	if !ok {
		return nil, false, nil
	}
	nodeValue := t.GetValue("/"+channel, true)
	if nodeValue.Handler == nil {
		return nil, false, nil
	}
	return nodeValue.Handler.(*LiveChannelRule), true, nil
}
