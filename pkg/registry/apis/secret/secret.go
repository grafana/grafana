package secret

import "context"

type Keeper interface {
	Store(ctx context.Context, sv SecureValue) (ManagedSecureValueID, error)
	Expose(ctx context.Context, id ManagedSecureValueID) (ExposedSecureValue, error)
	Delete(ctx context.Context, id ManagedSecureValueID) error
}

// ExposedSecureValue
type ExposedSecureValue struct {
	_ struct{}  // noCopy
	_ [0]func() // noCompare

	v string
}

func NewExposedSecureValue(v string) ExposedSecureValue {
	return ExposedSecureValue{v: v}
}

// Intentionally keep the name very long and weird so people realise this is a very dangerous operation and should be used carefully!
func (s ExposedSecureValue) DangerouslyExposeDecryptedValue() string {
	return s.v
}

func (s ExposedSecureValue) String() string {
	return "[REDACTED]"
}

func (s ExposedSecureValue) MarshalJSON() ([]byte, error) {
	return []byte{}, nil
}

func (s ExposedSecureValue) MarshalYAML() ([]byte, error) {
	return []byte{}, nil
}

// SecureValue
type SecureValue struct {
	Title string
	Value ExposedSecureValue
}

// ManagedSecureValueID
type ManagedSecureValueID string

func (s ManagedSecureValueID) String() string {
	return string(s)
}
