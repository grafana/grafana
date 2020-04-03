package social

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/jmespath/go-jmespath"
)

var (
	ErrMissingGroupMembership = &Error{"User not a member of one of the required groups"}
)

type HttpGetResponse struct {
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
		valid = valid || strings.HasSuffix(email, emailSuffix)
	}

	return valid
}

func HttpGet(client *http.Client, url string) (response HttpGetResponse, err error) {
	r, err := client.Get(url)
	if err != nil {
		return
	}

	defer r.Body.Close()

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return
	}

	response = HttpGetResponse{body, r.Header}

	if r.StatusCode >= 300 {
		err = fmt.Errorf(string(response.Body))
		return
	}

	log.Trace("HTTP GET %s: %s %s", url, r.Status, string(response.Body))

	err = nil
	return
}

func (s *SocialBase) searchJSONForAttr(attributePath string, data []byte) (string, error) {
	if attributePath == "" {
		return "", errors.New("no attribute path specified")
	}

	if len(data) == 0 {
		return "", errors.New("empty user info JSON response provided")
	}

	var buf interface{}
	if err := json.Unmarshal(data, &buf); err != nil {
		return "", errutil.Wrap("failed to unmarshal user info JSON response", err)
	}

	val, err := jmespath.Search(attributePath, buf)
	if err != nil {
		return "", errutil.Wrapf(err, "failed to search user info JSON response with provided path: %q", attributePath)
	}

	strVal, ok := val.(string)
	if ok {
		return strVal, nil
	}

	return "", nil
}
