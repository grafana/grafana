package nsq

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"math"
	"math/rand"
	"net"
	"os"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"
)

// Define handlers for setting config defaults, and setting config values from command line arguments or config files
type configHandler interface {
	HandlesOption(c *Config, option string) bool
	Set(c *Config, option string, value interface{}) error
	Validate(c *Config) error
}

type defaultsHandler interface {
	SetDefaults(c *Config) error
}

// BackoffStrategy defines a strategy for calculating the duration of time
// a consumer should backoff for a given attempt
type BackoffStrategy interface {
	Calculate(attempt int) time.Duration
}

// ExponentialStrategy implements an exponential backoff strategy (default)
type ExponentialStrategy struct {
	cfg *Config
}

// Calculate returns a duration of time: 2 ^ attempt
func (s *ExponentialStrategy) Calculate(attempt int) time.Duration {
	backoffDuration := s.cfg.BackoffMultiplier *
		time.Duration(math.Pow(2, float64(attempt)))
	return backoffDuration
}

func (s *ExponentialStrategy) setConfig(cfg *Config) {
	s.cfg = cfg
}

// FullJitterStrategy implements http://www.awsarchitectureblog.com/2015/03/backoff.html
type FullJitterStrategy struct {
	cfg *Config

	rngOnce sync.Once
	rng     *rand.Rand
}

// Calculate returns a random duration of time [0, 2 ^ attempt]
func (s *FullJitterStrategy) Calculate(attempt int) time.Duration {
	// lazily initialize the RNG
	s.rngOnce.Do(func() {
		if s.rng != nil {
			return
		}
		s.rng = rand.New(rand.NewSource(time.Now().UnixNano()))
	})

	backoffDuration := s.cfg.BackoffMultiplier *
		time.Duration(math.Pow(2, float64(attempt)))
	return time.Duration(s.rng.Intn(int(backoffDuration)))
}

func (s *FullJitterStrategy) setConfig(cfg *Config) {
	s.cfg = cfg
}

// Config is a struct of NSQ options
//
// The only valid way to create a Config is via NewConfig, using a struct literal will panic.
// After Config is passed into a high-level type (like Consumer, Producer, etc.) the values are no
// longer mutable (they are copied).
//
// Use Set(option string, value interface{}) as an alternate way to set parameters
type Config struct {
	initialized bool

	// used to Initialize, Validate
	configHandlers []configHandler

	DialTimeout time.Duration `opt:"dial_timeout" default:"1s"`

	// Deadlines for network reads and writes
	ReadTimeout  time.Duration `opt:"read_timeout" min:"100ms" max:"5m" default:"60s"`
	WriteTimeout time.Duration `opt:"write_timeout" min:"100ms" max:"5m" default:"1s"`

	// LocalAddr is the local address to use when dialing an nsqd.
	// If empty, a local address is automatically chosen.
	LocalAddr net.Addr `opt:"local_addr"`

	// Duration between polling lookupd for new producers, and fractional jitter to add to
	// the lookupd pool loop. this helps evenly distribute requests even if multiple consumers
	// restart at the same time
	//
	// NOTE: when not using nsqlookupd, LookupdPollInterval represents the duration of time between
	// reconnection attempts
	LookupdPollInterval time.Duration `opt:"lookupd_poll_interval" min:"10ms" max:"5m" default:"60s"`
	LookupdPollJitter   float64       `opt:"lookupd_poll_jitter" min:"0" max:"1" default:"0.3"`

	// Maximum duration when REQueueing (for doubling of deferred requeue)
	MaxRequeueDelay     time.Duration `opt:"max_requeue_delay" min:"0" max:"60m" default:"15m"`
	DefaultRequeueDelay time.Duration `opt:"default_requeue_delay" min:"0" max:"60m" default:"90s"`

	// Backoff strategy, defaults to exponential backoff. Overwrite this to define alternative backoff algrithms.
	BackoffStrategy BackoffStrategy `opt:"backoff_strategy" default:"exponential"`
	// Maximum amount of time to backoff when processing fails 0 == no backoff
	MaxBackoffDuration time.Duration `opt:"max_backoff_duration" min:"0" max:"60m" default:"2m"`
	// Unit of time for calculating consumer backoff
	BackoffMultiplier time.Duration `opt:"backoff_multiplier" min:"0" max:"60m" default:"1s"`

	// Maximum number of times this consumer will attempt to process a message before giving up
	MaxAttempts uint16 `opt:"max_attempts" min:"0" max:"65535" default:"5"`

	// Duration to wait for a message from a producer when in a state where RDY
	// counts are re-distributed (ie. max_in_flight < num_producers)
	LowRdyIdleTimeout time.Duration `opt:"low_rdy_idle_timeout" min:"1s" max:"5m" default:"10s"`

	// Duration between redistributing max-in-flight to connections
	RDYRedistributeInterval time.Duration `opt:"rdy_redistribute_interval" min:"1ms" max:"5s" default:"5s"`

	// Identifiers sent to nsqd representing this client
	// UserAgent is in the spirit of HTTP (default: "<client_library_name>/<version>")
	ClientID  string `opt:"client_id"` // (defaults: short hostname)
	Hostname  string `opt:"hostname"`
	UserAgent string `opt:"user_agent"`

	// Duration of time between heartbeats. This must be less than ReadTimeout
	HeartbeatInterval time.Duration `opt:"heartbeat_interval" default:"30s"`
	// Integer percentage to sample the channel (requires nsqd 0.2.25+)
	SampleRate int32 `opt:"sample_rate" min:"0" max:"99"`

	// To set TLS config, use the following options:
	//
	// tls_v1 - Bool enable TLS negotiation
	// tls_root_ca_file - String path to file containing root CA
	// tls_insecure_skip_verify - Bool indicates whether this client should verify server certificates
	// tls_cert - String path to file containing public key for certificate
	// tls_key - String path to file containing private key for certificate
	// tls_min_version - String indicating the minimum version of tls acceptable ('ssl3.0', 'tls1.0', 'tls1.1', 'tls1.2')
	//
	TlsV1     bool        `opt:"tls_v1"`
	TlsConfig *tls.Config `opt:"tls_config"`

	// Compression Settings
	Deflate      bool `opt:"deflate"`
	DeflateLevel int  `opt:"deflate_level" min:"1" max:"9" default:"6"`
	Snappy       bool `opt:"snappy"`

	// Size of the buffer (in bytes) used by nsqd for buffering writes to this connection
	OutputBufferSize int64 `opt:"output_buffer_size" default:"16384"`
	// Timeout used by nsqd before flushing buffered writes (set to 0 to disable).
	//
	// WARNING: configuring clients with an extremely low
	// (< 25ms) output_buffer_timeout has a significant effect
	// on nsqd CPU usage (particularly with > 50 clients connected).
	OutputBufferTimeout time.Duration `opt:"output_buffer_timeout" default:"250ms"`

	// Maximum number of messages to allow in flight (concurrency knob)
	MaxInFlight int `opt:"max_in_flight" min:"0" default:"1"`

	// The server-side message timeout for messages delivered to this client
	MsgTimeout time.Duration `opt:"msg_timeout" min:"0"`

	// secret for nsqd authentication (requires nsqd 0.2.29+)
	AuthSecret string `opt:"auth_secret"`
}

// NewConfig returns a new default nsq configuration.
//
// This must be used to initialize Config structs. Values can be set directly, or through Config.Set()
func NewConfig() *Config {
	c := &Config{
		configHandlers: []configHandler{&structTagsConfig{}, &tlsConfig{}},
		initialized:    true,
	}
	if err := c.setDefaults(); err != nil {
		panic(err.Error())
	}
	return c
}

// Set takes an option as a string and a value as an interface and
// attempts to set the appropriate configuration option.
//
// It attempts to coerce the value into the right format depending on the named
// option and the underlying type of the value passed in.
//
// Calls to Set() that take a time.Duration as an argument can be input as:
//
// 	"1000ms" (a string parsed by time.ParseDuration())
// 	1000 (an integer interpreted as milliseconds)
// 	1000*time.Millisecond (a literal time.Duration value)
//
// Calls to Set() that take bool can be input as:
//
// 	"true" (a string parsed by strconv.ParseBool())
// 	true (a boolean)
// 	1 (an int where 1 == true and 0 == false)
//
// It returns an error for an invalid option or value.
func (c *Config) Set(option string, value interface{}) error {
	c.assertInitialized()
	option = strings.Replace(option, "-", "_", -1)
	for _, h := range c.configHandlers {
		if h.HandlesOption(c, option) {
			return h.Set(c, option, value)
		}
	}
	return fmt.Errorf("invalid option %s", option)
}

func (c *Config) assertInitialized() {
	if !c.initialized {
		panic("Config{} must be created with NewConfig()")
	}
}

// Validate checks that all values are within specified min/max ranges
func (c *Config) Validate() error {
	c.assertInitialized()
	for _, h := range c.configHandlers {
		if err := h.Validate(c); err != nil {
			return err
		}
	}
	return nil
}

func (c *Config) setDefaults() error {
	for _, h := range c.configHandlers {
		hh, ok := h.(defaultsHandler)
		if ok {
			if err := hh.SetDefaults(c); err != nil {
				return err
			}
		}
	}
	return nil
}

type structTagsConfig struct{}

// Handle options that are listed in StructTags
func (h *structTagsConfig) HandlesOption(c *Config, option string) bool {
	val := reflect.ValueOf(c).Elem()
	typ := val.Type()
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		opt := field.Tag.Get("opt")
		if opt == option {
			return true
		}
	}
	return false
}

// Set values based on parameters in StructTags
func (h *structTagsConfig) Set(c *Config, option string, value interface{}) error {
	val := reflect.ValueOf(c).Elem()
	typ := val.Type()
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		opt := field.Tag.Get("opt")

		if option != opt {
			continue
		}

		min := field.Tag.Get("min")
		max := field.Tag.Get("max")

		fieldVal := val.FieldByName(field.Name)
		dest := unsafeValueOf(fieldVal)
		coercedVal, err := coerce(value, field.Type)
		if err != nil {
			return fmt.Errorf("failed to coerce option %s (%v) - %s",
				option, value, err)
		}
		if min != "" {
			coercedMinVal, _ := coerce(min, field.Type)
			if valueCompare(coercedVal, coercedMinVal) == -1 {
				return fmt.Errorf("invalid %s ! %v < %v",
					option, coercedVal.Interface(), coercedMinVal.Interface())
			}
		}
		if max != "" {
			coercedMaxVal, _ := coerce(max, field.Type)
			if valueCompare(coercedVal, coercedMaxVal) == 1 {
				return fmt.Errorf("invalid %s ! %v > %v",
					option, coercedVal.Interface(), coercedMaxVal.Interface())
			}
		}
		if coercedVal.Type().String() == "nsq.BackoffStrategy" {
			v := coercedVal.Interface().(BackoffStrategy)
			if v, ok := v.(interface {
				setConfig(*Config)
			}); ok {
				v.setConfig(c)
			}
		}
		dest.Set(coercedVal)
		return nil
	}
	return fmt.Errorf("unknown option %s", option)
}

func (h *structTagsConfig) SetDefaults(c *Config) error {
	val := reflect.ValueOf(c).Elem()
	typ := val.Type()
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		opt := field.Tag.Get("opt")
		defaultVal := field.Tag.Get("default")
		if defaultVal == "" || opt == "" {
			continue
		}

		if err := c.Set(opt, defaultVal); err != nil {
			return err
		}
	}

	hostname, err := os.Hostname()
	if err != nil {
		log.Fatalf("ERROR: unable to get hostname %s", err.Error())
	}

	c.ClientID = strings.Split(hostname, ".")[0]
	c.Hostname = hostname
	c.UserAgent = fmt.Sprintf("go-nsq/%s", VERSION)
	return nil
}

func (h *structTagsConfig) Validate(c *Config) error {
	val := reflect.ValueOf(c).Elem()
	typ := val.Type()
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)

		min := field.Tag.Get("min")
		max := field.Tag.Get("max")

		if min == "" && max == "" {
			continue
		}

		value := val.FieldByName(field.Name)

		if min != "" {
			coercedMinVal, _ := coerce(min, field.Type)
			if valueCompare(value, coercedMinVal) == -1 {
				return fmt.Errorf("invalid %s ! %v < %v",
					field.Name, value.Interface(), coercedMinVal.Interface())
			}
		}
		if max != "" {
			coercedMaxVal, _ := coerce(max, field.Type)
			if valueCompare(value, coercedMaxVal) == 1 {
				return fmt.Errorf("invalid %s ! %v > %v",
					field.Name, value.Interface(), coercedMaxVal.Interface())
			}
		}
	}

	if c.HeartbeatInterval > c.ReadTimeout {
		return fmt.Errorf("HeartbeatInterval %v must be less than ReadTimeout %v", c.HeartbeatInterval, c.ReadTimeout)
	}

	return nil
}

// Parsing for higher order TLS settings
type tlsConfig struct {
	certFile string
	keyFile  string
}

func (t *tlsConfig) HandlesOption(c *Config, option string) bool {
	switch option {
	case "tls_root_ca_file", "tls_insecure_skip_verify", "tls_cert", "tls_key", "tls_min_version":
		return true
	}
	return false
}

func (t *tlsConfig) Set(c *Config, option string, value interface{}) error {
	if c.TlsConfig == nil {
		c.TlsConfig = &tls.Config{
			MinVersion: tls.VersionTLS10,
			MaxVersion: tls.VersionTLS12, // enable TLS_FALLBACK_SCSV prior to Go 1.5: https://go-review.googlesource.com/#/c/1776/
		}
	}
	val := reflect.ValueOf(c.TlsConfig).Elem()

	switch option {
	case "tls_cert", "tls_key":
		if option == "tls_cert" {
			t.certFile = value.(string)
		} else {
			t.keyFile = value.(string)
		}
		if t.certFile != "" && t.keyFile != "" && len(c.TlsConfig.Certificates) == 0 {
			cert, err := tls.LoadX509KeyPair(t.certFile, t.keyFile)
			if err != nil {
				return err
			}
			c.TlsConfig.Certificates = []tls.Certificate{cert}
		}
		return nil
	case "tls_root_ca_file":
		filename, ok := value.(string)
		if !ok {
			return fmt.Errorf("ERROR: %v is not a string", value)
		}
		tlsCertPool := x509.NewCertPool()
		caCertFile, err := ioutil.ReadFile(filename)
		if err != nil {
			return fmt.Errorf("ERROR: failed to read custom Certificate Authority file %s", err)
		}
		if !tlsCertPool.AppendCertsFromPEM(caCertFile) {
			return fmt.Errorf("ERROR: failed to append certificates from Certificate Authority file")
		}
		c.TlsConfig.RootCAs = tlsCertPool
		return nil
	case "tls_insecure_skip_verify":
		fieldVal := val.FieldByName("InsecureSkipVerify")
		dest := unsafeValueOf(fieldVal)
		coercedVal, err := coerce(value, fieldVal.Type())
		if err != nil {
			return fmt.Errorf("failed to coerce option %s (%v) - %s",
				option, value, err)
		}
		dest.Set(coercedVal)
		return nil
	case "tls_min_version":
		version, ok := value.(string)
		if !ok {
			return fmt.Errorf("ERROR: %v is not a string", value)
		}
		switch version {
		case "ssl3.0":
			c.TlsConfig.MinVersion = tls.VersionSSL30
		case "tls1.0":
			c.TlsConfig.MinVersion = tls.VersionTLS10
		case "tls1.1":
			c.TlsConfig.MinVersion = tls.VersionTLS11
		case "tls1.2":
			c.TlsConfig.MinVersion = tls.VersionTLS12
		default:
			return fmt.Errorf("ERROR: %v is not a tls version", value)
		}
		return nil
	}

	return fmt.Errorf("unknown option %s", option)
}

func (t *tlsConfig) Validate(c *Config) error {
	return nil
}

// because Config contains private structs we can't use reflect.Value
// directly, instead we need to "unsafely" address the variable
func unsafeValueOf(val reflect.Value) reflect.Value {
	uptr := unsafe.Pointer(val.UnsafeAddr())
	return reflect.NewAt(val.Type(), uptr).Elem()
}

func valueCompare(v1 reflect.Value, v2 reflect.Value) int {
	switch v1.Type().String() {
	case "int", "int16", "int32", "int64":
		if v1.Int() > v2.Int() {
			return 1
		} else if v1.Int() < v2.Int() {
			return -1
		}
		return 0
	case "uint", "uint16", "uint32", "uint64":
		if v1.Uint() > v2.Uint() {
			return 1
		} else if v1.Uint() < v2.Uint() {
			return -1
		}
		return 0
	case "float32", "float64":
		if v1.Float() > v2.Float() {
			return 1
		} else if v1.Float() < v2.Float() {
			return -1
		}
		return 0
	case "time.Duration":
		if v1.Interface().(time.Duration) > v2.Interface().(time.Duration) {
			return 1
		} else if v1.Interface().(time.Duration) < v2.Interface().(time.Duration) {
			return -1
		}
		return 0
	}
	panic("impossible")
}

func coerce(v interface{}, typ reflect.Type) (reflect.Value, error) {
	var err error
	if typ.Kind() == reflect.Ptr {
		return reflect.ValueOf(v), nil
	}
	switch typ.String() {
	case "string":
		v, err = coerceString(v)
	case "int", "int16", "int32", "int64":
		v, err = coerceInt64(v)
	case "uint", "uint16", "uint32", "uint64":
		v, err = coerceUint64(v)
	case "float32", "float64":
		v, err = coerceFloat64(v)
	case "bool":
		v, err = coerceBool(v)
	case "time.Duration":
		v, err = coerceDuration(v)
	case "net.Addr":
		v, err = coerceAddr(v)
	case "nsq.BackoffStrategy":
		v, err = coerceBackoffStrategy(v)
	default:
		v = nil
		err = fmt.Errorf("invalid type %s", typ.String())
	}
	return valueTypeCoerce(v, typ), err
}

func valueTypeCoerce(v interface{}, typ reflect.Type) reflect.Value {
	val := reflect.ValueOf(v)
	if reflect.TypeOf(v) == typ {
		return val
	}
	tval := reflect.New(typ).Elem()
	switch typ.String() {
	case "int", "int16", "int32", "int64":
		tval.SetInt(val.Int())
	case "uint", "uint16", "uint32", "uint64":
		tval.SetUint(val.Uint())
	case "float32", "float64":
		tval.SetFloat(val.Float())
	default:
		tval.Set(val)
	}
	return tval
}

func coerceString(v interface{}) (string, error) {
	switch v := v.(type) {
	case string:
		return v, nil
	case int, int16, int32, int64, uint, uint16, uint32, uint64:
		return fmt.Sprintf("%d", v), nil
	case float32, float64:
		return fmt.Sprintf("%f", v), nil
	}
	return fmt.Sprintf("%s", v), nil
}

func coerceDuration(v interface{}) (time.Duration, error) {
	switch v := v.(type) {
	case string:
		return time.ParseDuration(v)
	case int, int16, int32, int64:
		// treat like ms
		return time.Duration(reflect.ValueOf(v).Int()) * time.Millisecond, nil
	case uint, uint16, uint32, uint64:
		// treat like ms
		return time.Duration(reflect.ValueOf(v).Uint()) * time.Millisecond, nil
	case time.Duration:
		return v, nil
	}
	return 0, errors.New("invalid value type")
}

func coerceAddr(v interface{}) (net.Addr, error) {
	switch v := v.(type) {
	case string:
		return net.ResolveTCPAddr("tcp", v)
	case net.Addr:
		return v, nil
	}
	return nil, errors.New("invalid value type")
}

func coerceBackoffStrategy(v interface{}) (BackoffStrategy, error) {
	switch v := v.(type) {
	case string:
		switch v {
		case "", "exponential":
			return &ExponentialStrategy{}, nil
		case "full_jitter":
			return &FullJitterStrategy{}, nil
		}
	case BackoffStrategy:
		return v, nil
	}
	return nil, errors.New("invalid value type")
}

func coerceBool(v interface{}) (bool, error) {
	switch v := v.(type) {
	case bool:
		return v, nil
	case string:
		return strconv.ParseBool(v)
	case int, int16, int32, int64:
		return reflect.ValueOf(v).Int() != 0, nil
	case uint, uint16, uint32, uint64:
		return reflect.ValueOf(v).Uint() != 0, nil
	}
	return false, errors.New("invalid value type")
}

func coerceFloat64(v interface{}) (float64, error) {
	switch v := v.(type) {
	case string:
		return strconv.ParseFloat(v, 64)
	case int, int16, int32, int64:
		return float64(reflect.ValueOf(v).Int()), nil
	case uint, uint16, uint32, uint64:
		return float64(reflect.ValueOf(v).Uint()), nil
	case float32:
		return float64(v), nil
	case float64:
		return v, nil
	}
	return 0, errors.New("invalid value type")
}

func coerceInt64(v interface{}) (int64, error) {
	switch v := v.(type) {
	case string:
		return strconv.ParseInt(v, 10, 64)
	case int, int16, int32, int64:
		return reflect.ValueOf(v).Int(), nil
	case uint, uint16, uint32, uint64:
		return int64(reflect.ValueOf(v).Uint()), nil
	}
	return 0, errors.New("invalid value type")
}

func coerceUint64(v interface{}) (uint64, error) {
	switch v := v.(type) {
	case string:
		return strconv.ParseUint(v, 10, 64)
	case int, int16, int32, int64:
		return uint64(reflect.ValueOf(v).Int()), nil
	case uint, uint16, uint32, uint64:
		return reflect.ValueOf(v).Uint(), nil
	}
	return 0, errors.New("invalid value type")
}
