package social

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/jmespath/go-jmespath"
)

var (
	ErrMissingGroupMembership = &Error{"User not a member of one of the required groups"}
)

type HttpGetResponse struct {
	Body    []byte
	Headers http.Header
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

func (s *SocialBase) searchJSONForAttr(attributePath string, data []byte) string {
	if attributePath == "" {
		s.log.Error("No attribute path specified")
		return ""
	}
	if len(data) == 0 {
		s.log.Error("Empty user info JSON response provided")
		return ""
	}
	var buf interface{}
	if err := json.Unmarshal(data, &buf); err != nil {
		s.log.Error("Failed to unmarshal user info JSON response", "err", err.Error())
		return ""
	}
	val, err := jmespath.Search(attributePath, buf)
	if err != nil {
		s.log.Error("Failed to search user info JSON response with provided path", "attributePath", attributePath, "err", err.Error())
		return ""
	}
	strVal, ok := val.(string)
	if ok {
		return strVal
	}
	s.log.Error("Attribute not found when searching JSON with provided path", "attributePath", attributePath)
	return ""
}
