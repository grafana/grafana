package gogit

import (
	"bytes"
	"errors"
	"testing"
)

func TestMaxBytesWriter(t *testing.T) {
	t.Run("should write data when under max size", func(t *testing.T) {
		buf := &bytes.Buffer{}
		maxSize := int64(10)
		exceedCalled := false
		writer := newMaxBytesWriter(buf, maxSize, func() {
			exceedCalled = true
		})

		data := []byte("hello")
		n, err := writer.Write(data)

		if err != nil {
			t.Errorf("expected no error, got %v", err)
		}
		if n != len(data) {
			t.Errorf("expected to write %d bytes, wrote %d", len(data), n)
		}
		if exceedCalled {
			t.Error("exceed callback should not have been called")
		}
		if got := buf.String(); got != "hello" {
			t.Errorf("expected buffer to contain 'hello', got %q", got)
		}
	})

	t.Run("should return error when max size exceeded", func(t *testing.T) {
		buf := &bytes.Buffer{}
		maxSize := int64(5)
		exceedCalled := false
		writer := newMaxBytesWriter(buf, maxSize, func() {
			exceedCalled = true
		})

		data := []byte("hello world")
		n, err := writer.Write(data)

		if !errors.Is(err, ErrMaxBytesExceeded) {
			t.Errorf("expected ErrMaxBytesExceeded, got %v", err)
		}
		if !exceedCalled {
			t.Error("exceed callback should have been called")
		}
		// The write should still complete even though max size was exceeded
		if n != len(data) {
			t.Errorf("expected to write %d bytes, wrote %d", len(data), n)
		}
	})

	t.Run("should not write after exceeding max size", func(t *testing.T) {
		buf := &bytes.Buffer{}
		maxSize := int64(5)
		writer := newMaxBytesWriter(buf, maxSize, nil)

		// First write exceeds max size
		_, _ = writer.Write([]byte("hello world"))

		// Second write should fail immediately
		n, err := writer.Write([]byte("more data"))
		if !errors.Is(err, ErrMaxBytesExceeded) {
			t.Errorf("expected ErrMaxBytesExceeded, got %v", err)
		}
		if n != 0 {
			t.Errorf("expected to write 0 bytes, wrote %d", n)
		}
	})

	t.Run("should allow unlimited writes when max size is 0", func(t *testing.T) {
		buf := &bytes.Buffer{}
		writer := newMaxBytesWriter(buf, 0, nil)

		data := []byte("this is a long string that would exceed most limits")
		n, err := writer.Write(data)

		if err != nil {
			t.Errorf("expected no error, got %v", err)
		}
		if n != len(data) {
			t.Errorf("expected to write %d bytes, wrote %d", len(data), n)
		}
		if got := buf.String(); got != string(data) {
			t.Errorf("expected buffer to contain %q, got %q", string(data), got)
		}
	})

	t.Run("should handle nil onExceed callback", func(t *testing.T) {
		buf := &bytes.Buffer{}
		maxSize := int64(5)
		writer := newMaxBytesWriter(buf, maxSize, nil)

		data := []byte("hello world")
		n, err := writer.Write(data)

		if !errors.Is(err, ErrMaxBytesExceeded) {
			t.Errorf("expected ErrMaxBytesExceeded, got %v", err)
		}
		if n != len(data) {
			t.Errorf("expected to write %d bytes, wrote %d", len(data), n)
		}
	})
}
