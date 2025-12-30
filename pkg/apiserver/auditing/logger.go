package auditing

import (
	"encoding/json"
	"time"
)

// Sinkable is a log entry abstraction that can be sent to an audit log sink through the different implementing methods.
type Sinkable interface {
	json.Marshaler
	KVPairs() []any
	Time() time.Time
}

// Logger specifies the contract for a specific audit logger.
type Logger interface {
	Log(entry Sinkable) error
	Close() error
	Type() string
}
