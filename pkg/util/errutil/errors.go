package errutil

import (
	"fmt"
)

// Wrap is a simple wrapper around fmt.Errorf that wraps errors.
func Wrap(message string, err error) error {
	if err == nil {
		return nil
	}

	return fmt.Errorf("%v: %w", message, err)
}

// Wrapf is a simple wrapper around fmt.Errorf that wraps errors.
// Wrapf allows you to send a format and args instead of just a message.
func Wrapf(err error, message string, a ...interface{}) error {
	if err == nil {
		return nil
	}

	return Wrap(fmt.Sprintf(message, a...), err)
}
