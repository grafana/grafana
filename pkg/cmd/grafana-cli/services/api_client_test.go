package services

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleResponse(t *testing.T) {
	t.Run("Returns body if status == 200", func(t *testing.T) {
		resp := makeResponse(200, "test")
		defer resp.Body.Close()
		bodyReader, err := handleResponse(resp)
		require.NoError(t, err)
		body, err := ioutil.ReadAll(bodyReader)
		require.NoError(t, err)
		assert.Equal(t, "test", string(body))
	})

	t.Run("Returns ErrorNotFound if status == 404", func(t *testing.T) {
		resp := makeResponse(404, "")
		defer resp.Body.Close()
		_, err := handleResponse(resp)
		assert.Equal(t, ErrNotFoundError, err)
	})

	t.Run("Returns message from body if status == 400", func(t *testing.T) {
		resp := makeResponse(400, "{ \"message\": \"error_message\" }")
		defer resp.Body.Close()
		_, err := handleResponse(resp)
		require.Error(t, err)
		assert.Equal(t, "error_message", asBadRequestError(t, err).Message)
	})

	t.Run("Returns body if status == 400 and no message key", func(t *testing.T) {
		resp := makeResponse(400, "{ \"test\": \"test_message\"}")
		defer resp.Body.Close()
		_, err := handleResponse(resp)
		require.Error(t, err)
		assert.Equal(t, "{ \"test\": \"test_message\"}", asBadRequestError(t, err).Message)
	})

	t.Run("Returns Bad request error if status == 400 and no body", func(t *testing.T) {
		resp := makeResponse(400, "")
		defer resp.Body.Close()
		_, err := handleResponse(resp)
		require.Error(t, err)
		_ = asBadRequestError(t, err)
	})

	t.Run("Returns error with invalid status if status == 500", func(t *testing.T) {
		resp := makeResponse(500, "")
		defer resp.Body.Close()
		_, err := handleResponse(resp)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid status")
	})
}

func makeResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       makeBody(body),
	}
}

func makeBody(body string) io.ReadCloser {
	return ioutil.NopCloser(bytes.NewReader([]byte(body)))
}

func asBadRequestError(t *testing.T, err error) *BadRequestError {
	if badRequestError, ok := err.(*BadRequestError); ok {
		return badRequestError
	}
	assert.FailNow(t, "Error was not of type BadRequestError")
	return nil
}
