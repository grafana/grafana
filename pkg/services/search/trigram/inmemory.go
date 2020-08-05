package trigram

import (
	"sync"
)

type inmemory struct {
	initd    sync.Once
	lock     sync.RWMutex
	trigrams map[string]map[TrigramKey]float64
}

func (m *inmemory) Set(key TrigramKey, score float64) error {
	m.initd.Do(func() {
		m.trigrams = map[string]map[TrigramKey]float64{}
	})

	m.lock.Lock()
	defer m.lock.Unlock()

	if current, exists := m.trigrams[key.Trigram]; exists {
		current[key] = score
	} else {
		m.trigrams[key.Trigram] = map[TrigramKey]float64{
			key: score,
		}
	}
	return nil
}

func (m *inmemory) Get(trigrams []string) (map[TrigramKey]float64, error) {
	m.lock.RLock()
	defer m.lock.RUnlock()

	res := map[TrigramKey]float64{}
	for _, trigram := range trigrams {
		tg := m.trigrams[trigram]
		for key, score := range tg {
			res[key] = score
		}
	}

	return res, nil
}
