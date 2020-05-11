package datasource

import (
	"fmt"
	"net/url"
	"regexp"

	"github.com/grafana/grafana/pkg/infra/log"
)

var logger = log.New("datasource")

// URLValidationError represents an error from validating a data source URL.
type URLValidationError struct {
	error

	url string
}

// Error returns the error message.
func (e URLValidationError) Error() string {
	return fmt.Sprintf("Validation of data source URL %q failed: %s", e.url, e.error.Error())
}

// Unwrap returns the wrapped error.
func (e URLValidationError) Unwrap() error {
	return e.error
}

// reURL is a regexp to detect if a URL specifies the protocol. We match also strings where the actual protocol is
// missing (i.e., "://"), in order to catch these as invalid when parsing.
var reURL = regexp.MustCompile("^[^:]*://")

// ValidateURL validates a data source URL.
//
// If successful, the valid URL object is returned, otherwise an error is returned.
func ValidateURL(urlStr string) (*url.URL, error) {
	// Make sure the URL starts with a protocol specifier, so parsing is unambiguous
	if !reURL.MatchString(urlStr) {
		logger.Debug(
			"Data source URL doesn't specify protocol, so prepending it with http:// in order to make it unambiguous")
		urlStr = fmt.Sprintf("http://%s", urlStr)
	}
	u, err := url.Parse(urlStr)
	if err != nil {
		return nil, URLValidationError{error: err, url: urlStr}
	}

	return u, nil
}
