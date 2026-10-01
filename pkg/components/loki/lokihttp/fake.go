package lokihttp

import (
	"sync"

	"github.com/prometheus/common/model"
)

type Fake struct {
	Labels model.LabelSet
	Entry  string

	entries chan Entry
	wg      *sync.WaitGroup
}

func NewFake() *Fake {
	c := &Fake{
		entries: make(chan Entry, 1),
		wg:      &sync.WaitGroup{},
	}

	c.wg.Go(func() {
		entry := <-c.entries
		c.Labels = entry.Labels
		c.Entry = entry.Line
	})

	return c
}

func (c *Fake) Stop() { c.wg.Wait() }

func (c *Fake) Chan() chan<- Entry { return c.entries }

func (c *Fake) StopNow() {}
