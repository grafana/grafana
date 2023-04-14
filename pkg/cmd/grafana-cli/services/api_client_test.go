package services

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleResponse(t *testing.T) {
	t.Run("Returns body if status == 200", func(t *testing.T) {
		// The body gets closed within makeResponse
		// nolint:bodyclose
		resp := makeResponse(t, 200, "test")
		bodyReader, err := handleResponse(resp)
		require.NoError(t, err)
		body, err := io.ReadAll(bodyReader)
		require.NoError(t, err)
		assert.Equal(t, "test", string(body))
	})

	t.Run("Returns ErrorNotFound if status == 404", func(t *testing.T) {
		// The body gets closed within makeResponse
		// nolint:bodyclose
		resp := makeResponse(t, 404, "")
		_, err := handleResponse(resp)
		assert.Equal(t, ErrNotFoundError, err)
	})

	t.Run("Returns message from body if status == 400", func(t *testing.T) {
		// The body gets closed within makeResponse
		// nolint:bodyclose
		resp := makeResponse(t, 400, "{ \"message\": \"error_message\" }")
		_, err := handleResponse(resp)
		require.Error(t, err)
		assert.Equal(t, "error_message", asBadRequestError(t, err).Message)
	})

	t.Run("Returns body if status == 400 and no message key", func(t *testing.T) {
		// The body gets closed within makeResponse
		// nolint:bodyclose
		resp := makeResponse(t, 400, "{ \"test\": \"test_message\"}")
		_, err := handleResponse(resp)
		require.Error(t, err)
		assert.Equal(t, "{ \"test\": \"test_message\"}", asBadRequestError(t, err).Message)
	})

	t.Run("Returns Bad request error if status == 400 and no body", func(t *testing.T) {
		// The body gets closed within makeResponse
		// nolint:bodyclose
		resp := makeResponse(t, 400, "")
		_, err := handleResponse(resp)
		require.Error(t, err)
		_ = asBadRequestError(t, err)
	})

	t.Run("Returns error with invalid status if status == 500", func(t *testing.T) {
		// The body gets closed within makeResponse
		// nolint:bodyclose
		resp := makeResponse(t, 500, "")
		_, err := handleResponse(resp)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid status")
	})
}

func makeResponse(t *testing.T, status int, body string) *http.Response {
	t.Helper()

	return &http.Response{
		StatusCode: status,
		Body:       makeBody(t, body),
	}
}

func makeBody(t *testing.T, body string) io.ReadCloser {
	t.Helper()

	reader := io.NopCloser(bytes.NewReader([]byte(body)))
	t.Cleanup(func() {
		err := reader.Close()
		assert.NoError(t, err)
	})
	return reader
}

func asBadRequestError(t *testing.T, err error) *BadRequestError {
	var badErr *BadRequestError
	if errors.As(err, &badErr) {
		return badErr
	}
	assert.FailNow(t, "Error was not of type BadRequestError")
	return nil
}
