package accesscontrol

import (
	"sync"
)

type RegistrationList struct {
	mx            sync.RWMutex
	registrations []RoleRegistration
}

func (m *RegistrationList) Append(regs ...RoleRegistration) {
	m.mx.Lock()
	defer m.mx.Unlock()
	m.registrations = append(m.registrations, regs...)
}

func (m *RegistrationList) Range(f func(registration RoleRegistration) bool) {
	m.mx.RLock()
	defer m.mx.RUnlock()
	for _, registration := range m.registrations {
		if ok := f(registration); !ok {
			return
		}
	}
}
