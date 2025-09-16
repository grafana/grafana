package datasource

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/tsdb/mssql"
)

var logger = log.New("datasource")

// requiredURL contains the set of data sources that require a URL.
var requiredURL = map[string]bool{
	datasources.DS_GRAPHITE:          true,
	datasources.DS_INFLUXDB:          true,
	datasources.DS_INFLUXDB_08:       true,
	datasources.DS_ES:                true,
	datasources.DS_PROMETHEUS:        true,
	datasources.DS_AMAZON_PROMETHEUS: true,
	datasources.DS_AZURE_PROMETHEUS:  true,
	datasources.DS_ALERTMANAGER:      true,
	datasources.DS_JAEGER:            true,
	datasources.DS_LOKI:              true,
	datasources.DS_OPENTSDB:          true,
	datasources.DS_TEMPO:             true,
	datasources.DS_ZIPKIN:            true,
	datasources.DS_MYSQL:             true,
	datasources.DS_POSTGRES:          true,
	datasources.DS_MSSQL:             true,
}

// URLValidationError represents an error from validating a data source URL.
type URLValidationError struct {
	Err error

	URL string
}

// Error returns the error message.
func (e URLValidationError) Error() string {
	return fmt.Sprintf("validation of data source URL %q failed: %s", e.URL, e.Err.Error())
}

// nolint:unused
// Unwrap returns the wrapped error.
// Used by errors package.
func (e URLValidationError) Unwrap() error {
	return e.Err
}

// reURL is a regexp to detect if a URL specifies the protocol. We match also strings where the actual protocol is
// missing (i.e., "://"), in order to catch these as invalid when parsing.
var reURL = regexp.MustCompile("^[^:]*://")

// ValidateURL validates a data source's URL.
//
// The data source's type and URL must be provided. If successful, the valid URL object is returned, otherwise an
// error is returned.
func ValidateURL(typeName, urlStr string) (*url.URL, error) {
	// Check for empty URLs
	if _, exists := requiredURL[typeName]; exists && strings.TrimSpace(urlStr) == "" {
		return nil, URLValidationError{Err: errors.New("empty URL string"), URL: ""}
	}

	var u *url.URL
	var err error
	switch strings.ToLower(typeName) {
	case "mssql":
		u, err = mssql.ParseURL(urlStr, logger)
	default:
		logger.Debug("Applying default URL parsing for this data source type", "type", typeName, "url", urlStr)

		// Make sure the URL starts with a protocol specifier, so parsing is unambiguous
		if !reURL.MatchString(urlStr) {
			logger.Debug(
				"Data source URL doesn't specify protocol, so prepending it with http:// in order to make it unambiguous",
				"type", typeName, "url", urlStr)
			urlStr = fmt.Sprintf("http://%s", urlStr)
		}
		u, err = url.Parse(urlStr)
	}
	if err != nil {
		return nil, URLValidationError{Err: err, URL: urlStr}
	}

	return u, nil
}
