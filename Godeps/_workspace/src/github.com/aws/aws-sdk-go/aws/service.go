package aws

import (
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"regexp"
	"time"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/private/endpoints"
)

// A Service implements the base service request and response handling
// used by all services.
type Service struct {
	Config            *Config
	Handlers          Handlers
	ServiceName       string
	APIVersion        string
	Endpoint          string
	SigningName       string
	SigningRegion     string
	JSONVersion       string
	TargetPrefix      string
	RetryRules        func(*Request) time.Duration
	ShouldRetry       func(*Request) bool
	DefaultMaxRetries uint
}

var schemeRE = regexp.MustCompile("^([^:]+)://")

// NewService will return a pointer to a new Server object initialized.
func NewService(config *Config) *Service {
	svc := &Service{Config: config}
	svc.Initialize()
	return svc
}

// Initialize initializes the service.
func (s *Service) Initialize() {
	if s.Config == nil {
		s.Config = &Config{}
	}
	if s.Config.HTTPClient == nil {
		s.Config.HTTPClient = http.DefaultClient
	}

	if s.RetryRules == nil {
		s.RetryRules = retryRules
	}

	if s.ShouldRetry == nil {
		s.ShouldRetry = shouldRetry
	}

	s.DefaultMaxRetries = 3
	s.Handlers.Validate.PushBack(ValidateEndpointHandler)
	s.Handlers.Build.PushBack(UserAgentHandler)
	s.Handlers.Sign.PushBack(BuildContentLength)
	s.Handlers.Send.PushBack(SendHandler)
	s.Handlers.AfterRetry.PushBack(AfterRetryHandler)
	s.Handlers.ValidateResponse.PushBack(ValidateResponseHandler)
	s.AddDebugHandlers()
	s.buildEndpoint()

	if !BoolValue(s.Config.DisableParamValidation) {
		s.Handlers.Validate.PushBack(ValidateParameters)
	}
}

// buildEndpoint builds the endpoint values the service will use to make requests with.
func (s *Service) buildEndpoint() {
	if StringValue(s.Config.Endpoint) != "" {
		s.Endpoint = *s.Config.Endpoint
	} else {
		s.Endpoint, s.SigningRegion =
			endpoints.EndpointForRegion(s.ServiceName, StringValue(s.Config.Region))
	}

	if s.Endpoint != "" && !schemeRE.MatchString(s.Endpoint) {
		scheme := "https"
		if BoolValue(s.Config.DisableSSL) {
			scheme = "http"
		}
		s.Endpoint = scheme + "://" + s.Endpoint
	}
}

// AddDebugHandlers injects debug logging handlers into the service to log request
// debug information.
func (s *Service) AddDebugHandlers() {
	if !s.Config.LogLevel.AtLeast(LogDebug) {
		return
	}

	s.Handlers.Send.PushFront(logRequest)
	s.Handlers.Send.PushBack(logResponse)
}

const logReqMsg = `DEBUG: Request %s/%s Details:
---[ REQUEST POST-SIGN ]-----------------------------
%s
-----------------------------------------------------`

func logRequest(r *Request) {
	logBody := r.Config.LogLevel.Matches(LogDebugWithHTTPBody)
	dumpedBody, _ := httputil.DumpRequestOut(r.HTTPRequest, logBody)

	r.Config.Logger.Log(fmt.Sprintf(logReqMsg, r.ServiceName, r.Operation.Name, string(dumpedBody)))
}

const logRespMsg = `DEBUG: Response %s/%s Details:
---[ RESPONSE ]--------------------------------------
%s
-----------------------------------------------------`

func logResponse(r *Request) {
	var msg = "no reponse data"
	if r.HTTPResponse != nil {
		logBody := r.Config.LogLevel.Matches(LogDebugWithHTTPBody)
		dumpedBody, _ := httputil.DumpResponse(r.HTTPResponse, logBody)
		msg = string(dumpedBody)
	} else if r.Error != nil {
		msg = r.Error.Error()
	}
	r.Config.Logger.Log(fmt.Sprintf(logRespMsg, r.ServiceName, r.Operation.Name, msg))
}

// MaxRetries returns the number of maximum returns the service will use to make
// an individual API request.
func (s *Service) MaxRetries() uint {
	if IntValue(s.Config.MaxRetries) < 0 {
		return s.DefaultMaxRetries
	}
	return uint(IntValue(s.Config.MaxRetries))
}

var seededRand = rand.New(rand.NewSource(time.Now().UnixNano()))

// retryRules returns the delay duration before retrying this request again
func retryRules(r *Request) time.Duration {

	delay := int(math.Pow(2, float64(r.RetryCount))) * (seededRand.Intn(30) + 30)
	return time.Duration(delay) * time.Millisecond
}

// retryableCodes is a collection of service response codes which are retry-able
// without any further action.
var retryableCodes = map[string]struct{}{
	"RequestError":                           {},
	"ProvisionedThroughputExceededException": {},
	"Throttling":                             {},
	"ThrottlingException":                    {},
	"RequestLimitExceeded":                   {},
	"RequestThrottled":                       {},
}

// credsExpiredCodes is a collection of error codes which signify the credentials
// need to be refreshed. Expired tokens require refreshing of credentials, and
// resigning before the request can be retried.
var credsExpiredCodes = map[string]struct{}{
	"ExpiredToken":          {},
	"ExpiredTokenException": {},
	"RequestExpired":        {}, // EC2 Only
}

func isCodeRetryable(code string) bool {
	if _, ok := retryableCodes[code]; ok {
		return true
	}

	return isCodeExpiredCreds(code)
}

func isCodeExpiredCreds(code string) bool {
	_, ok := credsExpiredCodes[code]
	return ok
}

// shouldRetry returns if the request should be retried.
func shouldRetry(r *Request) bool {
	if r.HTTPResponse.StatusCode >= 500 {
		return true
	}
	if r.Error != nil {
		if err, ok := r.Error.(awserr.Error); ok {
			return isCodeRetryable(err.Code())
		}
	}
	return false
}
