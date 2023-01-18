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
	if len(q.clients) == 0 {
		q.clients = append(q.clients, c)
	}

	for i, client := range q.clients {
		if len(q.clients) == i {
			q.clients = append(q.clients, client)
			break
		}

		if c.Priority() < client.Priority() {
			q.clients = append(q.clients[:i+1], q.clients[i:]...)
			q.clients[i] = c
			break
		}
	}
}
