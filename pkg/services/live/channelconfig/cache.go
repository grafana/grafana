package channelconfig

import (
	"os"
	"sync"

	"github.com/grafana/grafana/pkg/models"

	"github.com/fanyang01/radix"
)

var Fixtures = []models.LiveChannelConfig{
	{
		OrgId:   1,
		Channel: "stream/telegraf/*",
		Config: models.LiveChannelPlainConfig{
			RemoteWriteEndpoint:           os.Getenv("GF_LIVE_REMOTE_WRITE_ENDPOINT"),
			RemoteWriteSampleMilliseconds: 1000, // Write no frequently than once in a second.
		},
		Secure: models.LiveChannelSecureConfig{
			RemoteWriteUser:     os.Getenv("GF_LIVE_REMOTE_WRITE_USER"),
			RemoteWritePassword: os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD"),
		},
	},
}

type Cache struct {
	//cache   *localcache.CacheService
	radixMu sync.RWMutex
	radix   map[int64]*radix.PatternTrie
}

func NewCache(initialData []models.LiveChannelConfig) *Cache {
	s := &Cache{
		//cache: cache,
		radix: map[int64]*radix.PatternTrie{},
	}
	s.radixMu.Lock()
	defer s.radixMu.Unlock()
	for _, c := range initialData {
		_ = s.save(c)
		if _, ok := s.radix[c.OrgId]; !ok {
			s.radix[c.OrgId] = radix.NewPatternTrie()
		}
		s.radix[c.OrgId].Add(c.Channel, c)
	}
	return s
}

//func getCacheKey(orgID int64, channel string) string {
//	return fmt.Sprintf("live_channel_config_%d_%s", orgID, channel)
//}

func (s *Cache) Get(orgID int64, channel string) (models.LiveChannelConfig, bool, error) {
	s.radixMu.RLock()
	defer s.radixMu.RUnlock()
	t, ok := s.radix[orgID]
	if !ok {
		return models.LiveChannelConfig{}, false, nil
	}
	v, ok := t.Lookup(channel)
	if !ok {
		return models.LiveChannelConfig{}, false, nil
	}
	return v.(models.LiveChannelConfig), true, nil

	//v, ok := s.cache.Get(getCacheKey(orgID, channel))
	//if !ok {
	//	return models.LiveChannelConfig{}, false, nil
	//}
	//channelConfig, ok := v.(models.LiveChannelConfig)
	//if !ok {
	//	return models.LiveChannelConfig{}, false, fmt.Errorf("unexpected channel config type in cache: %T", v)
	//}
	//return channelConfig, true, nil
}

func (s *Cache) save(c models.LiveChannelConfig) error {
	if _, ok := s.radix[c.OrgId]; !ok {
		s.radix[c.OrgId] = radix.NewPatternTrie()
	}
	s.radix[c.OrgId].Add(c.Channel, c)
	//s.cache.Set(getCacheKey(channelConfig.OrgId, channelConfig.Channel), channelConfig, 0)
	return nil
}

func (s *Cache) Save(c models.LiveChannelConfig) error {
	s.radixMu.Lock()
	defer s.radixMu.Unlock()
	return s.save(c)
}
