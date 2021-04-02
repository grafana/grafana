package settings

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

var (
	ErrInvalidConfiguration  = errors.New("invalid configuration")
	ErrOperationNotPermitted = errors.New("operation not permitted")
)

// Provider is a settings provider abstraction
// with thread-safety and runtime updates.
type Provider interface {
	// Update
	Update(settings models.SettingsBag) error
	// KeyValue returns a key-value abstraction
	// for the given pair of section and key.
	KeyValue(section, key string) KeyValue
	// Section returns a settings section
	// abstraction for the given section name.
	Section(section string) Section
	// RegisterReloadHandler
	RegisterReloadHandler(section string, handler ReloadHandler)
}

// Section is a settings section copy
// with all of its pairs of keys-values.
type Section interface {
	// KeyValue returns a key-value
	// abstraction for the given key.
	KeyValue(key string) KeyValue
}

// KeyValue represents a settings key-value
// for a given pair of section and key.
type KeyValue interface {
	// Key returns pair's key.
	Key() string
	// Value returns pair's value.
	Value() string

	// MustString returns the value's string representation
	// If empty, then it returns the given default.
	MustString(defaultVal string) string
	// MustBool returns the value's boolean representation
	// Otherwise returns the given default.
	MustBool(defaultVal bool) bool
	// MustDuration returns the value's time.Duration
	// representation. Otherwise returns the given default.
	MustDuration(defaultVal time.Duration) time.Duration
}

type ReloadHandler interface {
	Reload(section Section) error
}
