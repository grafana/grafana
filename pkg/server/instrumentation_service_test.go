package server

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunInstrumentationService(t *testing.T) {
	s, err := NewInstrumentationService(log.New("test-logger"))
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err = services.StartAndAwaitRunning(ctx, s)
	require.NoError(t, err)

	client := http.Client{}
	res, err := client.Get("http://localhost:3000/metrics")
	require.NoError(t, err)
	err = res.Body.Close()
	require.NoError(t, err)
	assert.Equal(t, 200, res.StatusCode)

	err = s.stop(errors.New("test over"))
	require.NoError(t, err)
}
