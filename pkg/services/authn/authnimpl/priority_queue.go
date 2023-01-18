package authnimpl

type priority interface {
	Priority() uint
}

func newQueue[T priority]() *queue[T] {
	return &queue[T]{items: []T{}}
}


type queue[T priority] struct {
	items []T
}

func (q *queue[T]) insert(c T) {
	// no clients in the queue so we just add it
	if len(q.items) == 0 {
		q.items = append(q.items, c)
		return
	}

	// find the position in the queue the client should be placed based on priority
	for i, client := range q.items{
		if c.Priority() < client.Priority() {
			q.items= append(q.items[:i+1], q.items[i:]...)
			q.items[i] = c
			return
		}
	}

	// client did not have higher priority then what is in the queue currently, so we need to add it to the end
	q.items = append(q.items, c)
}
