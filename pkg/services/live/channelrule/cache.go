package channelrule

import (
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"github.com/fanyang01/radix"
)

type Storage interface {
	ListChannelRules(query models.ListLiveChannelRuleCommand) ([]*models.LiveChannelRule, error)
}

type Cache struct {
	radixMu sync.RWMutex
	radix   map[int64]*radix.PatternTrie
	storage Storage
}

func NewCache(storage Storage) *Cache {
	s := &Cache{
		radix:   map[int64]*radix.PatternTrie{},
		storage: storage,
	}
	go s.updatePeriodically()
	return s
}

func (s *Cache) updatePeriodically() {
	for {
		var orgIDs []int64
		s.radixMu.Lock()
		for orgID := range s.radix {
			orgIDs = append(orgIDs, orgID)
		}
		s.radixMu.Unlock()
		for _, orgID := range orgIDs {
			_ = s.fillOrg(orgID)
		}
		// TODO: make interval larger before merging.
		time.Sleep(5 * time.Second)
	}
}

func (s *Cache) fillOrg(orgID int64) error {
	channels, err := s.storage.ListChannelRules(models.ListLiveChannelRuleCommand{
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

func (s *Cache) Get(orgID int64, channel string) (*models.LiveChannelRule, bool, error) {
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
	return v.(*models.LiveChannelRule), true, nil
}

func (s *Cache) save(c models.LiveChannelRule) error {
	if _, ok := s.radix[c.OrgId]; !ok {
		s.radix[c.OrgId] = radix.NewPatternTrie()
	}
	s.radix[c.OrgId].Add(c.Pattern, c)
	return nil
}

func (s *Cache) Save(c models.LiveChannelRule) error {
	s.radixMu.Lock()
	defer s.radixMu.Unlock()
	return s.save(c)
}
