package azuseridentityclient

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestAzureTokenProvider_GetAccessTokenFromResponse(t *testing.T) {
	t.Run("Successful token parse", func(t *testing.T) {
		value := struct {
			Token     string      `json:"access_token"`
			ExpiresIn json.Number `json:"expires_in"`
			ExpiresOn string      `json:"expires_on"`
		}{
			Token:     "testtoken",
			ExpiresIn: "1000",
		}
		data, err := json.Marshal(value)
		assert.Empty(t, err, "failed to marshal data")

		body := io.NopCloser(bytes.NewReader(data))
		var resp = &http.Response{
			StatusCode: 200,
			Body:       body,
		}
		tokenClient := NewUserIdentityClient("https://test.io", "Bear xxxxx")
		token, err := tokenClient.getAccessTokenFromResponse(resp)
		assert.Empty(t, err, "failed on getting token")

		assert.Equal(t, value.Token, token.Token)

		timeMin := time.Now().UTC().Add(time.Second * 950)
		timeMax := timeMin.Add(time.Second * 100)
		assert.True(t, token.ExpiresOn.After(timeMin), "token.ExpiresOn is not after timeMin")
		assert.True(t, token.ExpiresOn.Before(timeMax), "token.ExpiresOn is not before timeMax")
	})

	t.Run("Fail token parse on bad status code", func(t *testing.T) {
		value := struct {
			Token     string      `json:"access_token"`
			ExpiresIn json.Number `json:"expires_in"`
			ExpiresOn string      `json:"expires_on"`
		}{
			Token:     "testtoken",
			ExpiresIn: "1000",
		}
		data, err := json.Marshal(value)
		assert.Empty(t, err, "failed to marshal data")

		body := io.NopCloser(bytes.NewReader(data))
		var resp = &http.Response{
			StatusCode: 401,
			Body:       body,
		}
		tokenClient := NewUserIdentityClient("https://test.io", "Bear xxxxx")
		_, err = tokenClient.getAccessTokenFromResponse(resp)
		assert.Error(t, err, "bad statuscode on token request: 401")
	})

	t.Run("Fail token parse on bad data", func(t *testing.T) {
		data, err := json.Marshal("bad test")
		assert.Empty(t, err, "failed to marshal data")

		body := io.NopCloser(bytes.NewReader(data))
		var resp = &http.Response{
			StatusCode: 200,
			Body:       body,
		}
		tokenClient := NewUserIdentityClient("https://test.io", "Bear xxxxx")
		_, err = tokenClient.getAccessTokenFromResponse(resp)
		assert.Contains(t, err.Error(), "failed to deserialize token response")
	})

	t.Run("Fail token parse on bad expiresIn", func(t *testing.T) {
		value := struct {
			Token     string      `json:"access_token"`
			ExpiresIn json.Number `json:"expires_in"`
			ExpiresOn string      `json:"expires_on"`
		}{
			Token:     "testtoken",
			ExpiresIn: "99.999",
		}
		data, err := json.Marshal(value)
		assert.Empty(t, err, "failed to marshal data")

		body := io.NopCloser(bytes.NewReader(data))
		var resp = &http.Response{
			StatusCode: 200,
			Body:       body,
		}
		tokenClient := NewUserIdentityClient("https://test.io", "Bear xxxxx")
		_, err = tokenClient.getAccessTokenFromResponse(resp)
		assert.Contains(t, err.Error(), "failed to get ExpiresIn property of the token")
	})
}
