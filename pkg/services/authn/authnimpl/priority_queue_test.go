package authnimpl

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn/clients"
)

func TestQueue(t *testing.T) {
	q := newQueue()

	anonymous := &clients.Anonymous{}
	q.insert(anonymous)
	session := &clients.Session{}
	q.insert(session)
	proxy := &clients.Proxy{}
	q.insert(proxy)
	render := &clients.Render{}
	q.insert(render)
	basic := &clients.Basic{}
	q.insert(basic)
	jwt := &clients.JWT{}
	q.insert(jwt)

	expectedOrder := []string{
		structName(render),
		structName(jwt),
		structName(basic),
		structName(proxy),
		structName(session),
		structName(anonymous),
	}

	require.Len(t, q.clients, len(expectedOrder))
	for i := range q.clients {
		assert.Equal(t, structName(q.clients[i]), expectedOrder[i])
	}
}

func structName(s any) string {
	return reflect.TypeOf(s).Elem().Name()
}
