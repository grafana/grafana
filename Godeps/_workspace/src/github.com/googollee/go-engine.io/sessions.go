package engineio

import (
	"sync"
)

type Sessions interface {
	Get(id string) Conn
	Set(id string, conn Conn)
	Remove(id string)
}

type serverSessions struct {
	sessions map[string]Conn
	locker   sync.RWMutex
}

func newServerSessions() *serverSessions {
	return &serverSessions{
		sessions: make(map[string]Conn),
	}
}

func (s *serverSessions) Get(id string) Conn {
	s.locker.RLock()
	defer s.locker.RUnlock()

	ret, ok := s.sessions[id]
	if !ok {
		return nil
	}
	return ret
}

func (s *serverSessions) Set(id string, conn Conn) {
	s.locker.Lock()
	defer s.locker.Unlock()

	s.sessions[id] = conn
}

func (s *serverSessions) Remove(id string) {
	s.locker.Lock()
	defer s.locker.Unlock()

	delete(s.sessions, id)
}
