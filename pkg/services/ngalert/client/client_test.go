package client

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTimedClient_operationName(t *testing.T) {
	r, err := http.NewRequest("GET", "https://weave.test", nil)
	assert.NoError(t, err)

	r = r.WithContext(context.WithValue(context.Background(), OperationNameContextKey, "opp"))
	c := NewTimedClient(http.DefaultClient, nil)

	assert.Equal(t, "opp", c.operationName(r))
}

func TestTimedClient_operationName_Default(t *testing.T) {
	r, err := http.NewRequest("GET", "https://weave.test/you/know/me", nil)
	assert.NoError(t, err)

	r = r.WithContext(context.Background())
	c := NewTimedClient(http.DefaultClient, nil)

	assert.Equal(t, "/you/know/me", c.operationName(r))
}
