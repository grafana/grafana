package polling

type Locker struct {
	locker chan struct{}
}

func NewLocker() *Locker {
	return &Locker{
		locker: make(chan struct{}, 1),
	}
}

func (l *Locker) Lock() {
	l.locker <- struct{}{}
}

func (l *Locker) TryLock() bool {
	select {
	case l.locker <- struct{}{}:
		return true
	default:
		return false
	}
}

func (l *Locker) Unlock() {
	<-l.locker
}
