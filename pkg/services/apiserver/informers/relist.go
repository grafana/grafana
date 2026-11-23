package informers

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
)

// reListInformer is the ReList mechanism as an SDK informer: it keeps no cache
// and delivers every object as an Add on each pass, so handlers must be
// idempotent and act on the object's own state, such as its age.
type reListInformer struct {
	client       resource.Client
	options      operator.ListWatchOptions
	interval     time.Duration
	pageSize     int
	errorHandler func(context.Context, error)

	mu       sync.Mutex
	handlers []operator.ResourceWatcher
	synced   chan struct{}
}

func newReListInformer(kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions) (operator.Informer, error) {
	resync := options.ResyncOptions()
	if resync == nil || resync.Interval <= 0 {
		return nil, fmt.Errorf("re-list informer for %s needs a resync interval", kind.GroupVersionKind())
	}
	client, err := clients.ClientFor(kind)
	if err != nil {
		return nil, err
	}
	return &reListInformer{
		client:       client,
		options:      options.ListWatchOptions,
		interval:     resync.Interval,
		pageSize:     int(resync.ListPageSize),
		errorHandler: options.ErrorHandler,
		synced:       make(chan struct{}),
	}, nil
}

func (r *reListInformer) AddEventHandler(handler operator.ResourceWatcher) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers = append(r.handlers, handler)
	return nil
}

// WaitForSync returns once the first pass has delivered every object.
func (r *reListInformer) WaitForSync(ctx context.Context) error {
	select {
	case <-r.synced:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (r *reListInformer) Run(ctx context.Context) error {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()
	var once sync.Once
	for {
		if err := r.pass(ctx); err != nil {
			r.handleError(ctx, err)
		} else {
			once.Do(func() { close(r.synced) })
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

func (r *reListInformer) pass(ctx context.Context) error {
	r.mu.Lock()
	handlers := r.handlers
	r.mu.Unlock()

	opts := resource.ListOptions{
		LabelFilters:   r.options.LabelFilters,
		FieldSelectors: r.options.FieldSelectors,
		Limit:          r.pageSize,
	}
	for {
		list, err := r.client.List(ctx, r.options.Namespace, opts)
		if err != nil {
			return fmt.Errorf("re-list: %w", err)
		}
		for _, obj := range list.GetItems() {
			for _, handler := range handlers {
				if err := handler.Add(ctx, obj); err != nil {
					r.handleError(ctx, err)
				}
			}
		}
		if opts.Continue = list.GetContinue(); opts.Continue == "" {
			return nil
		}
	}
}

func (r *reListInformer) handleError(ctx context.Context, err error) {
	if r.errorHandler != nil {
		r.errorHandler(ctx, err)
	}
}
