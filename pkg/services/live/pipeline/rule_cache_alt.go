package pipeline

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/live/pipeline/tree"
)

type CacheAlt struct {
	radixMu sync.RWMutex
	radix   map[int64]*tree.Node
	storage Storage
}

func NewCacheAlt(storage Storage) *CacheAlt {
	s := &CacheAlt{
		radix:   map[int64]*tree.Node{},
		storage: storage,
	}
	go s.updatePeriodically()
	return s
}

func (s *CacheAlt) updatePeriodically() {
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

func (s *CacheAlt) fillOrg(orgID int64) error {
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
	s.radix[orgID] = tree.New()
	for _, ch := range channels {
		s.radix[orgID].AddRoute("/"+ch.Pattern, ch)
	}
	return nil
}

func (s *CacheAlt) Get(orgID int64, channel string) (*LiveChannelRule, *tree.Params, bool, error) {
	s.radixMu.RLock()
	_, ok := s.radix[orgID]
	s.radixMu.RUnlock()
	if !ok {
		err := s.fillOrg(orgID)
		if err != nil {
			return nil, nil, false, err
		}
	}
	s.radixMu.RLock()
	defer s.radixMu.RUnlock()
	t, ok := s.radix[orgID]
	if !ok {
		return nil, nil, false, nil
	}
	v, params, _ := t.GetValue("/" + channel)
	if v == nil {
		return nil, nil, false, nil
	}
	return v.(*LiveChannelRule), params, true, nil
}
