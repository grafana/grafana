package settings

import (
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

var (
	ErrOperationNotPermitted = errors.New("operation not permitted")
)

type ValidationError struct {
	Errors []error
}

func (v ValidationError) Error() string {
	builder := strings.Builder{}

	for i, e := range v.Errors {
		builder.WriteString(e.Error())
		if i != len(v.Errors)-1 {
			builder.WriteString(", ")
		}
	}

	return builder.String()
}

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
	// RegisterReloadHandler registers a handler for validation and reload
	// of configuration updates tied to a specific section
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

// ReloadHandler makes it possible
type ReloadHandler interface {
	// Reload handles reloading of configuration changes
	Reload(section Section) error

	// Validate validates the configuration, if the validations
	// fails the configuration will not be updated in the database
	Validate(section Section) error
}
