package server

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunInstrumentationService(t *testing.T) {
	s, err := NewInstrumentationService(log.New("test-logger"))
	require.NoError(t, err)

	err = s.start(context.Background())
	require.NoError(t, err)

	go s.running(context.Background())

	require.NoError(t, err)
	time.Sleep(500 * time.Millisecond) // wait for http server to be running
	client := http.Client{}
	res, err := client.Get("http://localhost:3000/metrics")
	require.NoError(t, err)
	err = res.Body.Close()
	require.NoError(t, err)
	assert.Equal(t, 200, res.StatusCode)

	err = s.stop(errors.New("test over"))
	require.NoError(t, err)
}
