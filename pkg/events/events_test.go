package events

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type TestEvent struct {
	Timestamp time.Time
}

func TestEventCreation(t *testing.T) {
	e := TestEvent{
		Timestamp: time.Unix(1231421123, 223),
	}

	wire, err := ToOnWriteEvent(&e)
	require.NoError(t, err)
	assert.Equal(t, e.Timestamp.Unix(), wire.Timestamp.Unix())
	assert.Equal(t, "TestEvent", wire.EventType)
}
