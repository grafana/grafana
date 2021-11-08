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
	radixMu            sync.RWMutex
	radix              map[int64]*tree.Node
	builtinRadix       map[int64]*tree.Node
	ruleBuilder        RuleBuilder
	builtinRuleBuilder RuleBuilder
}

func NewCacheSegmentedTree(builder RuleBuilder, builtinBuilder RuleBuilder) *CacheSegmentedTree {
	s := &CacheSegmentedTree{
		radix:              map[int64]*tree.Node{},
		builtinRadix:       map[int64]*tree.Node{},
		ruleBuilder:        builder,
		builtinRuleBuilder: builtinBuilder,
	}
	go s.updatePeriodically()
	return s
}

func (s *CacheSegmentedTree) updatePeriodically() {
	for {
		var orgIDs []int64
		s.radixMu.Lock()
		for orgID := range s.radix {
			orgIDs = append(orgIDs, orgID)
		}
		s.radixMu.Unlock()
		for _, orgID := range orgIDs {
			err := s.fillOrg(orgID)
			if err != nil {
				logger.Error("error filling orgId", "error", err, "orgId", orgID)
			}
		}
		time.Sleep(20 * time.Second)
	}
}

func (s *CacheSegmentedTree) fillOrg(orgID int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	channels, err := s.ruleBuilder.BuildRules(ctx, orgID)
	if err != nil {
		return err
	}
	builtinChannels, err := s.builtinRuleBuilder.BuildRules(context.Background(), orgID)
	if err != nil {
		return err
	}
	s.radixMu.Lock()
	defer s.radixMu.Unlock()
	s.radix[orgID] = tree.New()
	for _, ch := range channels {
		s.radix[orgID].AddRoute("/"+ch.Pattern, ch)
	}
	s.builtinRadix[orgID] = tree.New()
	for _, ch := range builtinChannels {
		s.builtinRadix[orgID].AddRoute("/"+ch.Pattern, ch)
	}
	return nil
}

func (s *CacheSegmentedTree) Get(orgID int64, channel string) (*LiveChannelRule, bool, error) {
	s.radixMu.RLock()
	_, ok := s.radix[orgID]
	s.radixMu.RUnlock()
	if !ok {
		err := s.fillOrg(orgID)
		if err != nil {
			return nil, false, fmt.Errorf("error filling org: %w", err)
		}
	}
	s.radixMu.RLock()
	defer s.radixMu.RUnlock()
	t, ok := s.radix[orgID]
	if !ok {
		return nil, false, nil
	}
	nodeValue := t.GetValue("/"+channel, true)
	if nodeValue.Handler != nil {
		return nodeValue.Handler.(*LiveChannelRule), true, nil
	}
	t, ok = s.builtinRadix[orgID]
	if !ok {
		return nil, false, nil
	}
	nodeValue = t.GetValue("/"+channel, true)
	if nodeValue.Handler != nil {
		return nodeValue.Handler.(*LiveChannelRule), true, nil
	}
	return nil, false, nil
}
