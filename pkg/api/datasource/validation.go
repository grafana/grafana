package datasource

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/util"

	goval "github.com/asaskevich/govalidator"
	reporting_scheduler "github.com/grafana/grafana/pkg/services/scheduler"

	// bmc code change
	"github.com/grafana/grafana/pkg/api/externalds"
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

func init() {
	goval.SetFieldsRequiredByDefault(true)
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

// author ateli - Mitigation for SSRF issue - DRJ71-3206
// Start
func ValidateSSRF(cmdType string, urlStr string, platformURL string, orgId int64) (*url.URL, error) {
	SSRFLogger := log.New("ssrf")

	// Hardcoded datasource types to validate
	dsToValidate := []string{
		datasources.DS_BMC_HELIX,
		datasources.DS_BMC_JSON,
		datasources.DS_ALERTMANAGER,
		datasources.DS_ZIPKIN,
		datasources.DS_TEMPO,
		datasources.DS_PROMETHEUS,
		datasources.DS_LOKI,
		datasources.DS_OPENTSDB,
		datasources.DS_ES,
	}

	// Get other allowed domains from environment variable
	dsToValidateStr := os.Getenv("GF_SSRF_DATASOURCES")

	// Add domains from environment variable to allowed domains list
	if dsToValidateStr == "" {
		SSRFLogger.Debug("GF_SSRF_DATASOURCES environment variable is not set")
	} else {
		dataSources := strings.Split(dsToValidateStr, ",")
		for _, datasource := range dataSources {
			if datasource != "" {
				dsToValidate = append(dsToValidate, datasource)
			}
		}
	}

	// Check if the datasource in the list to validate
	shouldValidate := util.Contains(dsToValidate, cmdType)
	if shouldValidate {

		// Get tenant details to get tenant domain
		tenantDetails, err := reporting_scheduler.GetTenantDetails(orgId)
		if err != nil {
			return nil, err
		}

		// Check if the URL is safe to use
		if !externalds.IsExternalDs(cmdType) {
			err = IsSafeURL(urlStr, tenantDetails.Domain)
			if err != nil {
				return nil, err
			}
		}

		// Check if the URL is reachable
		err = Ping(urlStr)
		if err != nil {
			return nil, fmt.Errorf("Provided URL is not reachable")
		}
		
		// Check if the platform URL is reachable if the datasource is BMC Helix ADE
		if cmdType == datasources.DS_BMC_HELIX {
			if platformURL != "" {
				perr := Ping(platformURL)
				if perr != nil {
					return nil, fmt.Errorf("Platform URL is not reachable")
				}
			}
		}
	}

	// For non bmc domains check for SSRF
	var RESTRICTED_STACK_DOMAINS = os.Getenv("RESTRICTED_STACK_DOMAINS")
	var EXTERNAL_URL_IDENTIFIERS = os.Getenv("EXTERNAL_URL_IDENTIFIERS")
	var EXTERNAL_URL_VALIDATION_PATTERN = os.Getenv("EXTERNAL_URL_VALIDATION_PATTERN")

	if RESTRICTED_STACK_DOMAINS != "" && EXTERNAL_URL_IDENTIFIERS != "" && EXTERNAL_URL_VALIDATION_PATTERN != "" {

		regexTpl := strings.Replace(EXTERNAL_URL_VALIDATION_PATTERN, "#CUSTOMER#", "([a-zA-Z0-9-]+)", -1)
		regexTpl = strings.Replace(regexTpl, ".#TENANT_NAME#", "(.)([a-zA-Z0-9-]+)", -1)
		regexTpl = strings.Replace(regexTpl, "#ENV_NAME#", "([a-zA-Z0-9-]+)", -1)
		regexTpl = strings.Replace(regexTpl, ".#DOMAIN#", "(.)([a-zA-Z0-9-.]+)", -1)
		regexTpl = strings.Replace(regexTpl, "#PORT#", "([:0-9]*)", -1)

		regexTpl = fmt.Sprintf("(%s)", regexTpl)

		reg := regexp.MustCompile(regexTpl)
		match := reg.MatchString(urlStr)
		if !match {
			return nil, fmt.Errorf("URL validation failed, Please follow the allowed URL pattern")
		}
		res := reg.FindStringSubmatch(urlStr)

		if len(res) < 6 {
			return nil, fmt.Errorf("URL is not Allowed")
		}
		DOMAIN := res[7]
		CUSTOMER := res[2]

		restrictedDomains := strings.Split(RESTRICTED_STACK_DOMAINS, ",")
		isValidDomain := false
		for _, restrictedDomain := range restrictedDomains {
			if DOMAIN == restrictedDomain {
				isValidDomain = true
			}
		}
		if !isValidDomain {
			_, err := ValidateSSRFForNonBMCDomain(urlStr, cmdType)
			if err != nil {
				return nil, fmt.Errorf(err.Error())
			}
		}

		externalUrlIdentifiers := strings.Split(EXTERNAL_URL_IDENTIFIERS, ",")
		isValidCustomer := false
		for _, identifiers := range externalUrlIdentifiers {
			if CUSTOMER == identifiers {
				isValidCustomer = true
			}
		}
		if !isValidCustomer {
			return nil, fmt.Errorf("customer is not allowed")
		}

		return nil, nil
	}
	_, err := ValidateSSRFForNonBMCDomain(urlStr, cmdType)
	if err != nil {
		return nil, fmt.Errorf(err.Error())
	}

	return nil, nil
}

func ValidateSSRFForNonBMCDomain(urlStr string, cmdType string) (*url.URL, error) {
	dsURL, err := url.Parse(urlStr)

	//Valid URL Check
	if err != nil {
		return nil, fmt.Errorf("invalid URL Pattern, Please provide valid URL")
	}
	_, dsPort, _ := net.SplitHostPort(dsURL.Host)
	dsAddress := dsURL.Host

	//IP Address Check
	isIPAddress := goval.IsIP(dsAddress)
	if isIPAddress {
		return nil, fmt.Errorf("IP Address is not allowed, Please provide FQDN")
	}

	// Port Number Check
	if dsPort != "" && !externalds.IsExternalDs(cmdType) {
		return nil, fmt.Errorf("port is not allowed, Please provide FQDN")
	}

	//Protocol Check
	if (dsURL.Scheme == "HTTP" || dsURL.Scheme == "http") && !externalds.IsExternalDs(cmdType) {
		return nil, fmt.Errorf("HTTP Protocol is not allowed, Please provide HTTPS URL")

	}
	return nil, nil
}
func Ping(domain string) error {
	resp, err := http.Get(domain)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return err
}

//End

// BMC Code - start - author kmejdi
func IsSafeURL(urlStr, tenantDomain string) error {
	SSRFLogger := log.New("ssrf")

	SSRFLogger.Info("Validating datasource domain", "ds_url", urlStr, "tenant_domain", tenantDomain)
	// Hardcoded bmc domains
	allowedDomains := []string{"bmc.com", "onbmc.com"}

	// Get other allowed domains from environment variable
	allowedDomainsStr := os.Getenv("GF_SSRF_ALLOWED_DOMAINS")

	// Add domains from environment variable to allowed domains list
	if allowedDomainsStr == "" {
		SSRFLogger.Debug("GF_SSRF_ALLOWED_DOMAINS environment variable is not set")
	} else {
		domains := strings.Split(allowedDomainsStr, ",")
		for _, domain := range domains {
			if domain != "" {
				allowedDomains = append(allowedDomains, domain)
			}
		}
	}

	// Add tenant domain to allowed domains list
	if tenantDomain != "" {
		tenantParts := strings.Split(tenantDomain, ".")
		if len(tenantParts) > 1 {
			tenantDomain = tenantParts[len(tenantParts)-2] + "." + tenantParts[len(tenantParts)-1]
		}
		allowedDomains = append(allowedDomains, tenantDomain)
	}
	SSRFLogger.Info("Whitelisted domains for datasource", "domains", strings.Join(allowedDomains, ", "))

	// Add https to url if not present to avoid parsing errors
	if !strings.Contains(urlStr, "https://") {
		urlStr = "https://" + urlStr
	}

	// Parse url and get hostname
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return fmt.Errorf(`Failed to parse URL, Please configure url with valid URL`)
	}
	host := parsedURL.Hostname()
	// Check if hostname is in allowed domains list
	for _, domain := range allowedDomains {
		if strings.HasSuffix(host, domain) {
			return nil
		}
	}

	SSRFLogger.Info("Datasource domain is not allowed", "ds_url", urlStr, "host", host, "tenant_domain", tenantDomain, "allowed_domains", allowedDomains)

	// Return false if hostname is not in allowed domains list
	return fmt.Errorf(`Domain not allowed, Please configure url with valid domain`)
}

// BMC Code - end
