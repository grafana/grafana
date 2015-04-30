package cache

import (
	"sync"

	"bosun.org/_third_party/github.com/golang/groupcache/lru"
	"bosun.org/_third_party/github.com/golang/groupcache/singleflight"
)

type Cache struct {
	g singleflight.Group

	sync.Mutex
	lru *lru.Cache
}

// obj is an LRU object tracking data and a corresponding error.
type obj struct {
	Val interface{}
	Err error
}

func New(MaxEntries int) *Cache {
	return &Cache{
		lru: lru.New(MaxEntries),
	}
}

func (c *Cache) Get(key string, getFn func() (interface{}, error)) (interface{}, error) {
	c.Lock()
	result, ok := c.lru.Get(key)
	c.Unlock()
	if ok {
		res := result.(*obj)
		return res.Val, res.Err
	}
	// our lock only serves to protect the lru.
	// we can (and should!) do singleflight requests concurently
	return c.g.Do(key, func() (interface{}, error) {
		v, err := getFn()
		c.Lock()
		c.lru.Add(key, &obj{v, err})
		c.Unlock()
		return v, err
	})
}
