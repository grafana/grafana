package pipeline

import (
	"context"
	"sync"
	"time"

	"github.com/fanyang01/radix"
)

type CacheWildcardRadix struct {
	radixMu sync.RWMutex
	radix   map[int64]*radix.PatternTrie
	storage Storage
}

func NewCacheWildcardRadix(storage Storage) *CacheWildcardRadix {
	s := &CacheWildcardRadix{
		radix:   map[int64]*radix.PatternTrie{},
		storage: storage,
	}
	go s.updatePeriodically()
	return s
}

func (s *CacheWildcardRadix) updatePeriodically() {
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
				logger.Error("error filling orgId", "error", err.Error(), "orgId", orgID)
			}
		}
		time.Sleep(20 * time.Second)
	}
}

func (s *CacheWildcardRadix) fillOrg(orgID int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	channels, err := s.storage.ListChannelRules(ctx, ListLiveChannelRuleCommand{
		OrgId: orgID,
	})
	if err != nil {
		return err
	}
	s.radixMu.Lock()
	defer s.radixMu.Unlock()
	s.radix[orgID] = radix.NewPatternTrie()
	for _, ch := range channels {
		s.radix[orgID].Add(ch.Pattern, ch)
	}
	return nil
}

func (s *CacheWildcardRadix) Get(orgID int64, channel string) (*LiveChannelRule, bool, error) {
	s.radixMu.RLock()
	_, ok := s.radix[orgID]
	s.radixMu.RUnlock()
	if !ok {
		err := s.fillOrg(orgID)
		if err != nil {
			return nil, false, err
		}
	}
	s.radixMu.RLock()
	defer s.radixMu.RUnlock()
	t, ok := s.radix[orgID]
	if !ok {
		return nil, false, nil
	}
	v, ok := t.Lookup(channel)
	if !ok {
		return nil, false, nil
	}
	return v.(*LiveChannelRule), true, nil
}

func (s *CacheWildcardRadix) save(c LiveChannelRule) error {
	if _, ok := s.radix[c.OrgId]; !ok {
		s.radix[c.OrgId] = radix.NewPatternTrie()
	}
	s.radix[c.OrgId].Add(c.Pattern, c)
	return nil
}

func (s *CacheWildcardRadix) Save(c LiveChannelRule) error {
	s.radixMu.Lock()
	defer s.radixMu.Unlock()
	return s.save(c)
}
