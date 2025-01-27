package async

import "time"

type Async interface {
	Go(f func())
	Tick(interval time.Duration, f func() bool)
}

type AsyncImpl struct{}

func NewAsync() *AsyncImpl {
	return &AsyncImpl{}
}

func (a *AsyncImpl) Go(f func()) {
	go f()
}

func (a *AsyncImpl) Tick(interval time.Duration, f func() bool) {
	go func() {
		tick := time.NewTicker(interval)
		defer tick.Stop()

		for {
			<-tick.C

			if f() {
				return
			}
		}
	}()
}
