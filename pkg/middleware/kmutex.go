package middleware

import (
	"sync"
)

type Kmutex struct {
	m *sync.Map
}

func NewKmutex() Kmutex {
	m := sync.Map{}
	return Kmutex{&m}
}

func (s Kmutex) Unlock(key interface{}) {
	l, exist := s.m.Load(key)
	if !exist {
		panic("kmutex: unlock of unlocked mutex")
	}
	lck := l.(*sync.Mutex)
	s.m.Delete(key)
	lck.Unlock()
}

func (s Kmutex) IsLocked(key interface{}) bool {
	_, exist := s.m.Load(key)
	return exist
}

func (s Kmutex) Lock(key interface{}) {
	m := sync.Mutex{}
	lck, _ := s.m.LoadOrStore(key, &m)
	mm := lck.(*sync.Mutex)
	mm.Lock()
	if mm != &m {
		mm.Unlock()
		s.Lock(key)
		return
	}
	return
}
