package social

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
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
