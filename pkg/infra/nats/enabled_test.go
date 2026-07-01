package nats

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// fakeEnabler is a minimal Enabler for exercising Enabled.
type fakeEnabler struct{ enabled bool }

func (f fakeEnabler) Enabled() bool { return f.enabled }

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
			name:    "typed-nil enabler interface is not enabled",
			enabler: Enabler(nil),
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
}
