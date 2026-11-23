package v0alpha1

import (
	"maps"
	"slices"

	"github.com/grafana/grafana-app-sdk/resource"
)

// SetSecureValue stores value under key, or removes the key when value is zero.
// Zero entries must not be stored: the secure value store rejects them.
func (o *Repository) SetSecureValue(key string, value resource.InlineSecureValue) {
	o.Secure = setSecureValue(o.Secure, key, value)
}

// NormalizeSecureValues drops unknown keys and zero entries from Secure.
func (o *Repository) NormalizeSecureValues() {
	o.Secure = normalizeSecureValues(o.Secure, RepositorySecureKeys)
}

// SetSecureValue stores value under key, or removes the key when value is zero.
// Zero entries must not be stored: the secure value store rejects them.
func (o *Connection) SetSecureValue(key string, value resource.InlineSecureValue) {
	o.Secure = setSecureValue(o.Secure, key, value)
}

// NormalizeSecureValues drops unknown keys and zero entries from Secure.
func (o *Connection) NormalizeSecureValues() {
	o.Secure = normalizeSecureValues(o.Secure, ConnectionSecureKeys)
}

func setSecureValue(values resource.InlineSecureValues, key string, value resource.InlineSecureValue) resource.InlineSecureValues {
	if value.IsZero() {
		delete(values, key)
		return values
	}
	if values == nil {
		values = resource.InlineSecureValues{}
	}
	values[key] = value
	return values
}

// Secure used to decode into a struct, which silently dropped unknown keys and
// zero entries. Keep that behavior: the secure value store would otherwise
// create secrets for arbitrary keys and reject zero entries.
func normalizeSecureValues(values resource.InlineSecureValues, allowedKeys []string) resource.InlineSecureValues {
	maps.DeleteFunc(values, func(key string, value resource.InlineSecureValue) bool {
		return value.IsZero() || !slices.Contains(allowedKeys, key)
	})
	if len(values) == 0 {
		return nil
	}
	return values
}
