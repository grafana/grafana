package errutil

import (
	"context"
	"log"
	"sync"
)

type Group struct {
	cancel  func()
	wg      sync.WaitGroup
	errOnce sync.Once
	err     error
}

func GroupWithContext(ctx context.Context) (*Group, context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	return &Group{cancel: cancel}, ctx
}

// Wait waits for any wrapped goroutines to finish and returns any error having occurred in one of them.
func (g *Group) Wait() error {
	log.Println("Waiting on Group")
	g.wg.Wait()
	if g.cancel != nil {
		log.Println("Group canceling its context after waiting")
		g.cancel()
	}
	return g.err
}

// Cancel cancels the associated context.
func (g *Group) Cancel() {
	log.Println("Group's Cancel method being called")
	g.cancel()
}

// Wrap wraps a function to be executed in a goroutine.
func (g *Group) Wrap(f func() error) func() {
	g.wg.Add(1)
	return func() {
		defer g.wg.Done()

		if err := f(); err != nil {
			g.errOnce.Do(func() {
				log.Printf("An error occurred in Group: %s", err)
				g.err = err
				if g.cancel != nil {
					log.Println("Group canceling its context due to error")
					g.cancel()
				}
			})
		}
	}
}

// Go wraps the provided function and executes it in a goroutine.
func (g *Group) Go(f func() error) {
	wrapped := g.Wrap(f)
	go wrapped()
}
