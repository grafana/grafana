package azuseridentityclient

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
)

// TokenResponse is the response from the UserIdentityClient
type TokenResponse struct {
	Token     string
	ExpiresOn time.Time
}

// UserIdentityClient is the client to retrieve user identity token
type UserIdentityClient struct {
	tokenEndpoint string // token endpoint to retrieve the token from
	authHeader    string // exact Authorization header to be used to talk to the token endpoint
	client        *http.Client
}

// GetUserAccessToken retieves the access token for a user and the specified scopes
func (c *UserIdentityClient) GetUserAccessToken(userID string, scopes []string) (*TokenResponse, error) {
	req, err := http.NewRequest("POST", c.tokenEndpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create token request, %w", err)
	}

	// Token server supports POST method with parameters in the body
	data := url.Values{}
	data.Set("scope", strings.Join(scopes, " "))
	data.Set("user_id", userID)
	dataEncoded := data.Encode()
	body := streaming.NopCloser(strings.NewReader(dataEncoded))

	size, err := body.Seek(0, io.SeekEnd) // Seek to the end to get the stream's size
	if err != nil {
		return nil, err
	}
	_, err = body.Seek(0, io.SeekStart)
	if err != nil {
		return nil, err
	}

	req.Body = body
	req.ContentLength = size
	req.Header.Set("Content-Length", strconv.FormatInt(size, 10))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	if c.authHeader != "" {
		req.Header.Set("Authorization", c.authHeader)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get AccessToken: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Println("error closing response:", err)
		}
	}()

	return c.getAccessTokenFromResponse(resp)
}

func (c *UserIdentityClient) getAccessTokenFromResponse(resp *http.Response) (*TokenResponse, error) {
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return nil, fmt.Errorf("bad statuscode on token request: %d", resp.StatusCode)
	}

	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read token response: %w", err)
	}

	value := struct {
		Token     string      `json:"access_token"`
		ExpiresIn json.Number `json:"expires_in"`
		ExpiresOn string      `json:"expires_on"`
	}{}

	if err := json.Unmarshal(respBody, &value); err != nil {
		return nil, fmt.Errorf("failed to deserialize token response: %w", err)
	}
	t, err := value.ExpiresIn.Int64()
	if err != nil {
		return nil, fmt.Errorf("failed to get ExpiresIn property of the token: %w", err)
	}
	return &TokenResponse{
		Token:     value.Token,
		ExpiresOn: time.Now().Add(time.Second * time.Duration(t)).UTC(),
	}, nil
}

// NewUserIdentityClient creates a user identity token client
func NewUserIdentityClient(tokenEndpoint, authHeader string) *UserIdentityClient {
	return &UserIdentityClient{
		tokenEndpoint: tokenEndpoint,
		authHeader:    authHeader,
		client:        &http.Client{Timeout: time.Second * 10},
	}
}
