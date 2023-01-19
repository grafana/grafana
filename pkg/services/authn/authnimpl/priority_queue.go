package authnimpl

type priority interface {
	Priority() uint
}

func newQueue[T any]() *queue[T] {
	return &queue[T]{items: []queueItem[T]{}}
}

type queue[T any] struct {
	items []queueItem[T]
}

type queueItem[T any] struct {
	v T
	p uint
}

func (q *queue[T]) insert(v T, p uint) {
	// no clients in the queue so we just add it
	if len(q.items) == 0 {
		q.items = append(q.items, queueItem[T]{v, p})
		return
	}

	// find the position in the queue the client should be placed based on priority
	for i, item := range q.items {
		if p < item.p {
			q.items = append(q.items[:i+1], q.items[i:]...)
			q.items[i] = queueItem[T]{v, p}
			return
		}
	}

	// client did not have higher priority then what is in the queue currently, so we need to add it to the end
	q.items = append(q.items, queueItem[T]{v, p})
}
