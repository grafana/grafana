package authnimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
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
		authn.ClientRender,
		authn.ClientJWT,
		authn.ClientBasic,
		authn.ClientProxy,
		authn.ClientSession,
		authn.ClientAnonymous,
	}

	require.Len(t, q.clients, len(expectedOrder))
	for i := range q.clients {
		assert.Equal(t, q.clients[i].Name(), expectedOrder[i])
	}
}
