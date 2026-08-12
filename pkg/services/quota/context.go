package quota

import (
	"context"
	"sync"
)

type Context struct {
	context.Context
	TargetToSrv *TargetToSrv
}

func FromContext(ctx context.Context, targetToSrv *TargetToSrv) Context {
	if targetToSrv == nil {
		targetToSrv = NewTargetToSrv()
	}
	return Context{Context: ctx, TargetToSrv: targetToSrv}
}

type TargetToSrv struct {
	mutex sync.RWMutex
	m     map[Target]TargetSrv
}

func NewTargetToSrv() *TargetToSrv {
	return &TargetToSrv{m: make(map[Target]TargetSrv)}
}

func (m *TargetToSrv) Get(target Target) (TargetSrv, bool) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	srv, ok := m.m[target]
	return srv, ok
}

func (m *TargetToSrv) Set(target Target, srv TargetSrv) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.m[target] = srv
}
