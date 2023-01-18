package authnimpl

import (
	"github.com/grafana/grafana/pkg/services/authn"
)

func newQueue() *queue {
	return &queue{clients: []authn.ContextAwareClient{}}
}

type queue struct {
	clients []authn.ContextAwareClient
}

func (q *queue) insert(c authn.ContextAwareClient) {
	// no clients in the queue so we just add it
	if len(q.clients) == 0 {
		q.clients = append(q.clients, c)
		return
	}

	// find the position in the queue the client should be placed based on priority
	for i, client := range q.clients {
		if c.Priority() < client.Priority() {
			q.clients = append(q.clients[:i+1], q.clients[i:]...)
			q.clients[i] = c
			return
		}
	}

	// client did not have higher priority then what is in the queue currently, so we need to add it to the end
	q.clients = append(q.clients, c)
}
