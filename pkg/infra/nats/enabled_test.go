package nats

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// fakeEnabler is a minimal Enabler for exercising Enabled.
type fakeEnabler struct{ enabled bool }

func (f fakeEnabler) Enabled() bool { return f.enabled }

// ptrEnabler is a pointer-receiver Enabler whose method dereferences the
// receiver, so calling it on a typed-nil pointer panics — exactly the case
// Enabled must short-circuit before invoking.
type ptrEnabler struct{ enabled bool }

func (p *ptrEnabler) Enabled() bool { return p.enabled }

func TestEnabled(t *testing.T) {
	tests := []struct {
		name    string
		enabler Enabler
		want    bool
	}{
		{
			name:    "nil enabler is not enabled",
			enabler: nil,
			want:    false,
		},
		{
			// A non-nil interface holding a nil pointer: != nil, and Enabled() would
			// panic dereferencing the receiver, so Enabled must short-circuit.
			name:    "typed-nil pointer enabler is not enabled",
			enabler: (*ptrEnabler)(nil),
			want:    false,
		},
		{
			name:    "enabler reporting false",
			enabler: fakeEnabler{enabled: false},
			want:    false,
		},
		{
			name:    "enabler reporting true",
			enabler: fakeEnabler{enabled: true},
			want:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, Enabled(tt.enabler))
		})
	}
}

// A nil Subscriber/Publisher (the concrete interfaces that embed Enabler) is not
// enabled — the check callers rely on to gate the NATS path.
func TestEnabled_NilTransports(t *testing.T) {
	var sub Subscriber
	var pub Publisher
	assert.False(t, Enabled(sub), "nil Subscriber must not be enabled")
	assert.False(t, Enabled(pub), "nil Publisher must not be enabled")

	// Typed-nil concrete transports (a nil *SubscriberService/*PublisherService
	// stored in the interface) must not be enabled either, and must not panic:
	// their Enabled() dereferences the embedded *connection.
	var subSvc *SubscriberService
	var pubSvc *PublisherService
	assert.False(t, Enabled(subSvc), "typed-nil *SubscriberService must not be enabled")
	assert.False(t, Enabled(pubSvc), "typed-nil *PublisherService must not be enabled")
}
