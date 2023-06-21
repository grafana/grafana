package social

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/jmespath/go-jmespath"
)

var (
	errMissingGroupMembership = &Error{"user not a member of one of the required groups"}
)

type httpGetResponse struct {
	Body    []byte
	Headers http.Header
}

func (s *SocialBase) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *SocialBase) IsSignupAllowed() bool {
	return s.allowSignup
}

func isEmailAllowed(email string, allowedDomains []string) bool {
	if len(allowedDomains) == 0 {
		return true
	}

	valid := false
	for _, domain := range allowedDomains {
		emailSuffix := fmt.Sprintf("@%s", domain)
		valid = valid || strings.HasSuffix(strings.ToLower(email), strings.ToLower(emailSuffix))
	}

	return valid
}

func (s *SocialBase) httpGet(ctx context.Context, client *http.Client, url string) (*httpGetResponse, error) {
	req, errReq := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if errReq != nil {
		return nil, errReq
	}

	r, errDo := client.Do(req)
	if errDo != nil {
		return nil, errDo
	}

	defer func() {
		if err := r.Body.Close(); err != nil {
			s.log.Warn("Failed to close response body", "err", err)
		}
	}()

	body, errRead := io.ReadAll(r.Body)
	if errRead != nil {
		return nil, errRead
	}

	response := &httpGetResponse{body, r.Header}

	if r.StatusCode >= 300 {
		return nil, fmt.Errorf("unsuccessful response status code %d: %s", r.StatusCode, string(response.Body))
	}

	s.log.Debug("HTTP GET", "url", url, "status", r.Status, "response_body", string(response.Body))

	return response, nil
}

func (s *SocialBase) searchJSONForAttr(attributePath string, data []byte) (interface{}, error) {
	if attributePath == "" {
		return "", errors.New("no attribute path specified")
	}

	if len(data) == 0 {
		return "", errors.New("empty user info JSON response provided")
	}

	var buf interface{}
	if err := json.Unmarshal(data, &buf); err != nil {
		return "", fmt.Errorf("%v: %w", "failed to unmarshal user info JSON response", err)
	}

	val, err := jmespath.Search(attributePath, buf)
	if err != nil {
		return "", fmt.Errorf("failed to search user info JSON response with provided path: %q: %w", attributePath, err)
	}

	return val, nil
}

func (s *SocialBase) searchJSONForStringAttr(attributePath string, data []byte) (string, error) {
	val, err := s.searchJSONForAttr(attributePath, data)
	if err != nil {
		return "", err
	}

	strVal, ok := val.(string)
	if ok {
		return strVal, nil
	}

	return "", nil
}

func (s *SocialBase) searchJSONForStringArrayAttr(attributePath string, data []byte) ([]string, error) {
	val, err := s.searchJSONForAttr(attributePath, data)
	if err != nil {
		return []string{}, err
	}

	ifArr, ok := val.([]interface{})
	if !ok {
		return []string{}, nil
	}

	result := []string{}
	for _, v := range ifArr {
		if strVal, ok := v.(string); ok {
			result = append(result, strVal)
		}
	}

	return result, nil
}
