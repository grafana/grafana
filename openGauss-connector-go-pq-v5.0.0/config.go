package pq

import (
	"crypto/tls"
	"errors"
	"fmt"
	pgpassfile "gitee.com/opengauss/openGauss-connector-go-pq/pgpassfile"
	"gitee.com/opengauss/openGauss-connector-go-pq/pgservicefile"
	"math"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	paramClientEncoding              = "client_encoding"
	paramAllowEncodingChanges        = "allow_encoding_changes"
	paramLoggerLevel                 = "loggerLevel"
	paramCpBufferSize                = "cp_buffer_size"
	paramMinReadBufferSize           = "min_read_buffer_size"
	paramTargetSessionAttrs          = "target_session_attrs"
	paramHost                        = "host"
	paramPort                        = "port"
	paramDatabase                    = "database"
	paramUser                        = "user"
	paramPassword                    = "password"
	paramPassFile                    = "passfile"
	paramConnectTimeout              = "connect_timeout"
	paramSSLMode                     = "sslmode"
	paramSSLKey                      = "sslkey"
	paramSSLCert                     = "sslcert"
	paramSSLRootCert                 = "sslrootcert"
	paramSSLinLine                   = "sslinline"
	paramSSLPassword                 = "sslpassword"
	paramService                     = "service"
	paramKrbSrvName                  = "krbsrvname"
	paramKrbSpn                      = "krbspn"
	paramServiceFile                 = "servicefile"
	paramDisablePreparedBinaryResult = "disable_prepared_binary_result"
	paramApplicationName             = "application_name"
)

// Config is the settings used to establish a connection to a PostgreSQL server. It must be created by ParseConfig. A
// manually initialized Config will cause ConnectConfig to panic.
type Config struct {
	Host           string // host (e.g. localhost) or absolute path to unix domain socket directory (e.g. /private/tmp)
	Port           uint16
	Database       string
	User           string
	Password       string
	TLSConfig      *tls.Config // nil disables TLS
	ConnectTimeout time.Duration
	DialFunc       DialFunc   // e.g. net.Dialer.DialContext
	LookupFunc     LookupFunc // e.g. net.Resolver.LookupHost
	// BuildFrontend  BuildFrontendFunc
	RuntimeParams map[string]string // Run-time parameters to set on connection as session default values (e.g. search_path or application_name)
	GssAPIParams  map[string]string
	Fallbacks     []*FallbackConfig

	targetSessionAttrs string
	minReadBufferSize  int64 // The minimum size of the internal read buffer. Default 8192.
	cpBufferSize       int64 // Defines the size of the copy buffer. Default 65535.

	// ValidateConnect is called during a connection attempt after a successful authentication with the PostgreSQL server.
	// It can be used to validate that the server is acceptable. If this returns an error the connection is closed and the next
	// fallback config is tried. This allows implementing high availability behavior such as libpq does with target_session_attrs.

	ValidateConnect ValidateConnectFunc

	// AfterConnect is called after ValidateConnect. It can be used to set up the connection (e.g. Set session variables
	// or prepare statements). If this returns an error the connection attempt fails.
	// AfterConnect AfterConnectFunc

	// OnNotice is a callback function called when a notice response is received.
	// OnNotice NoticeHandler

	// OnNotification is a callback function called when a notification from the LISTEN/NOTIFY system is received.
	// OnNotification NotificationHandler

	createdByParseConfig bool // Used to enforce created by ParseConfig rule.

	Logger   Logger
	LogLevel LogLevel

	// When using the V3 protocol the driver monitors changes in certain server configuration parameters
	// that should not be touched by end users.
	// The client_encoding setting is set by the driver and should not be altered.
	// If the driver detects a change it will abort the connection.
	// There is one legitimate exception to this behaviour though,
	// using the COPY command on a file residing on the server's filesystem.
	// The only means of specifying the encoding of this file is by altering the client_encoding setting.
	// The JDBC team considers this a failing of the COPY command and hopes to provide an alternate means of specifying
	// the encoding in the future, but for now there is this URL parameter.
	// Enable this only if you need to override the client encoding when doing a copy.
	allowEncodingChanges string
}

// Copy returns a deep copy of the config that is safe to use and modify.
// The only exception is the TLSConfig field:
// according to the tls.Config docs it must not be modified after creation.
func (c *Config) Copy() *Config {
	newConf := new(Config)
	*newConf = *c
	if newConf.TLSConfig != nil {
		newConf.TLSConfig = c.TLSConfig.Clone()
	}
	if newConf.RuntimeParams != nil {
		newConf.RuntimeParams = make(map[string]string, len(c.RuntimeParams))
		for k, v := range c.RuntimeParams {
			newConf.RuntimeParams[k] = v
		}
	}
	if newConf.Fallbacks != nil {
		newConf.Fallbacks = make([]*FallbackConfig, len(c.Fallbacks))
		for i, fallback := range c.Fallbacks {
			newFallback := new(FallbackConfig)
			*newFallback = *fallback
			if newFallback.TLSConfig != nil {
				newFallback.TLSConfig = fallback.TLSConfig.Clone()
			}
			newConf.Fallbacks[i] = newFallback
		}
	}
	return newConf
}
func (c *Config) shouldLog(lvl LogLevel) bool {
	return c.Logger != nil && c.LogLevel >= lvl
}

// FallbackConfig is additional settings to attempt a connection with when the primary Config fails to establish a
// network connection. It is used for TLS fallback such as sslmode=prefer and high availability (HA) connections.
type FallbackConfig struct {
	Host      string // host (e.g. localhost) or path to unix domain socket directory (e.g. /private/tmp)
	Port      uint16
	TLSConfig *tls.Config // nil disables TLS
}

// NetworkAddress converts a PostgreSQL host and port into network and address suitable for use with
// net.Dial.
func NetworkAddress(host string, port uint16) (network, address string) {
	if strings.HasPrefix(host, "/") {
		network = "unix"
		address = filepath.Join(host, ".s.PGSQL.") + strconv.FormatInt(int64(port), 10)
	} else {
		network = "tcp"
		address = net.JoinHostPort(host, strconv.Itoa(int(port)))
	}
	return network, address
}

// ParseConfig builds a *Config with similar behavior to the PostgreSQL standard C library libpq. It uses the same
// defaults as libpq (e.g. port=5432) and understands most PG* environment variables. ParseConfig closely matches
// the parsing behavior of libpq. connString may either be in URL format or keyword = value format (DSN style). See
// https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING for details. connString also may be
// empty to only read from the environment. If a password is not supplied it will attempt to read the .pgpass file.
//
//   # Example DSN
//   user=jack password=secret host=pg.example.com port=5432 dbname=mydb sslmode=verify-ca
//
//   # Example URL
//   postgres://jack:secret@pg.example.com:5432/mydb?sslmode=verify-ca
//
// The returned *Config may be modified. However, it is strongly recommended that any configuration that can be done
// through the connection string be done there. In particular the fields Host, Port, TLSConfig, and Fallbacks can be
// interdependent (e.g. TLSConfig needs knowledge of the host to validate the server certificate). These fields should
// not be modified individually. They should all be modified or all left unchanged.
//
// ParseConfig supports specifying multiple hosts in similar manner to libpq. Host and port may include comma separated
// values that will be tried in order. This can be used as part of a high availability system. See
// https://www.postgresql.org/docs/11/libpq-connect.html#LIBPQ-MULTIPLE-HOSTS for more information.
//
//   # Example URL
//   postgres://jack:secret@foo.example.com:5432,bar.example.com:5432/mydb
//
// ParseConfig currently recognizes the following environment variable and their parameter key word equivalents passed
// via database URL or DSN:
//
// 	 PGHOST
// 	 PGPORT
// 	 PGDATABASE
// 	 PGUSER
// 	 PGPASSWORD
// 	 PGPASSFILE
// 	 PGSERVICE
// 	 PGSERVICEFILE
// 	 PGSSLMODE
// 	 PGSSLCERT
// 	 PGSSLKEY
// 	 PGSSLROOTCERT
// 	 PGAPPNAME
// 	 PGCONNECT_TIMEOUT
// 	 PGTARGETSESSIONATTRS
//
// See http://www.postgresql.org/docs/11/static/libpq-envars.html for details on the meaning of environment variables.
//
// See https://www.postgresql.org/docs/11/libpq-connect.html#LIBPQ-PARAMKEYWORDS for parameter key word names. They are
// usually but not always the environment variable name downcased and without the "PG" prefix.
//
// Important Security Notes:
//
// ParseConfig tries to match libpq behavior with regard to PGSSLMODE. This includes defaulting to "prefer" behavior if
// not set.
//
// See http://www.postgresql.org/docs/11/static/libpq-ssl.html#LIBPQ-SSL-PROTECTION for details on what level of
// security each sslmode provides.
//
// The sslmode "prefer" (the default), sslmode "allow", and multiple hosts are implemented via the Fallbacks field of
// the Config struct. If TLSConfig is manually changed it will not affect the fallbacks. For example, in the case of
// sslmode "prefer" this means it will first try the main Config settings which use TLS, then it will try the fallback
// which does not use TLS. This can lead to an unexpected unencrypted connection if the main TLS config is manually
// changed later but the unencrypted fallback is present. Ensure there are no stale fallbacks when manually setting
// TLCConfig.
//
// Other known differences with libpq:
//
// If a host name resolves into multiple addresses, libpq will try all addresses. pgconn will only try the first.
//
// When multiple hosts are specified, libpq allows them to have different passwords set via the .pgpass file. pgconn
// does not.
//
// In addition, ParseConfig accepts the following options:
//
// 	min_read_buffer_size
// 		The minimum size of the internal read buffer. Default 8192.
// 	servicefile
// 		libpq only reads servicefile from the PGSERVICEFILE environment variable. ParseConfig accepts servicefile as a
// 		part of the connection string.
func ParseConfig(connString string) (*Config, error) {
	defaultSettings := defaultSettings()
	envSettings := parseEnvSettings()

	connStringSettings, err := ParseURLToMap(connString)
	if err != nil {
		return nil, err
	}

	settings := mergeSettings(defaultSettings, envSettings, connStringSettings)
	if service, present := settings[paramService]; present {
		serviceSettings, err := parseServiceSettings(settings[paramServiceFile], service)
		if err != nil {
			return nil, &parseConfigError{connString: connString, msg: "failed to read service", err: err}
		}
		settings = mergeSettings(defaultSettings, envSettings, serviceSettings, connStringSettings)
	}

	minReadBufferSize, err := strconv.ParseInt(settings[paramMinReadBufferSize], 10, 32)
	if err != nil {
		return nil, &parseConfigError{connString: connString, msg: "cannot parse min_read_buffer_size", err: err}
	}
	if minReadBufferSize == 0 {
		minReadBufferSize = 8192
	}
	cpBufferSize, err := strconv.ParseInt(settings[paramCpBufferSize], 10, 32)
	if err != nil {
		return nil, &parseConfigError{connString: connString, msg: "cannot parse cp_buffer_size", err: err}
	}
	if cpBufferSize == 0 {
		cpBufferSize = 65535
	}
	config := &Config{
		createdByParseConfig: true,
		Database:             settings[paramDatabase],
		User:                 settings[paramUser],
		Password:             settings[paramPassword],
		RuntimeParams:        make(map[string]string),
		minReadBufferSize:    minReadBufferSize,
		cpBufferSize:         cpBufferSize,
		// BuildFrontend:        makeDefaultBuildFrontendFunc(int(minReadBufferSize)),
	}

	if connectTimeoutSetting, present := settings[paramConnectTimeout]; present {
		connectTimeout, err := parseConnectTimeoutSetting(connectTimeoutSetting)
		if err != nil {
			return nil, &parseConfigError{connString: connString, msg: "invalid connect_timeout", err: err}
		}
		config.ConnectTimeout = connectTimeout
		config.DialFunc = makeConnectTimeoutDialFunc(connectTimeout)
	} else {
		defaultDialer := makeDefaultDialer()
		config.DialFunc = defaultDialer.DialContext
	}

	config.LookupFunc = makeDefaultResolver().LookupHost

	notRuntimeParams := map[string]struct{}{
		paramHost:                        {},
		paramPort:                        {},
		paramDatabase:                    {},
		paramUser:                        {},
		paramPassword:                    {},
		paramPassFile:                    {},
		paramConnectTimeout:              {},
		paramSSLMode:                     {},
		paramSSLKey:                      {},
		paramSSLCert:                     {},
		paramSSLRootCert:                 {},
		paramSSLinLine:                   {},
		paramSSLPassword:                 {},
		paramTargetSessionAttrs:          {},
		paramMinReadBufferSize:           {},
		paramService:                     {},
		paramKrbSrvName:                  {},
		paramKrbSpn:                      {},
		paramServiceFile:                 {},
		paramDisablePreparedBinaryResult: {},
		paramLoggerLevel:                 {},
		paramCpBufferSize:                {},
		paramAllowEncodingChanges:        {},
	}

	for k, v := range settings {
		if _, present := notRuntimeParams[k]; present {
			continue
		}
		config.RuntimeParams[k] = v
	}
	if value, ok := settings[paramLoggerLevel]; ok {
		var err error
		config.LogLevel, err = LogLevelFromString(strings.ToLower(value))
		if err != nil {
			return nil, err
		}
		if config.Logger == nil {
			config.Logger = NewPrintfLogger(config.LogLevel)
		}
	}
	if value, ok := settings[paramAllowEncodingChanges]; ok {
		config.allowEncodingChanges = value
	}

	fallbacks := []*FallbackConfig{}

	hosts := strings.Split(settings[paramHost], ",")
	ports := strings.Split(settings[paramPort], ",")
	gssAPIParams, err := configGssAPI(settings)
	if err != nil {
		return nil, &parseConfigError{connString: connString, msg: "failed to configure GSSAPI", err: err}
	}
	config.GssAPIParams = gssAPIParams
	for i, host := range hosts {
		var portStr string
		if i < len(ports) {
			portStr = ports[i]
		} else {
			portStr = ports[0]
		}

		port, err := parsePort(portStr)
		if err != nil {
			return nil, &parseConfigError{connString: connString, msg: "invalid port", err: err}
		}

		var tlsConfigs []*tls.Config

		// Ignore TLS settings if Unix domain socket like libpq
		if network, _ := NetworkAddress(host, port); network == "unix" {
			tlsConfigs = append(tlsConfigs, nil)
		} else {
			var err error
			tlsConfigs, err = configTLS(settings)
			if err != nil {
				return nil, &parseConfigError{connString: connString, msg: "failed to configure TLS", err: err}
			}
		}

		for _, tlsConfig := range tlsConfigs {
			fallbacks = append(
				fallbacks, &FallbackConfig{
					Host:      host,
					Port:      port,
					TLSConfig: tlsConfig,
				},
			)
		}
	}

	config.Host = fallbacks[0].Host
	config.Port = fallbacks[0].Port
	config.TLSConfig = fallbacks[0].TLSConfig
	config.Fallbacks = fallbacks[1:]

	passFile, err := pgpassfile.ReadPassfile(settings[paramPassFile])
	if err == nil {
		if config.Password == "" {
			host := config.Host
			if network, _ := NetworkAddress(config.Host, config.Port); network == "unix" {
				host = "localhost"
			}
			config.Password = passFile.FindPassword(host, strconv.Itoa(int(config.Port)), config.Database, config.User)
		}
	}

	switch tsa := settings[paramTargetSessionAttrs]; tsa {
	case "read-write":
		config.ValidateConnect = ValidateConnectTargetSessionAttrsReadWrite
		config.targetSessionAttrs = tsa
	case "read-only":
		config.ValidateConnect = ValidateConnectTargetSessionAttrsReadOnly
		config.targetSessionAttrs = tsa
	case "primary":
		config.ValidateConnect = ValidateConnectTargetSessionAttrsPrimary
		config.targetSessionAttrs = tsa
	case "standby":
		config.ValidateConnect = ValidateConnectTargetSessionAttrsStandby
		config.targetSessionAttrs = tsa
	case "any", "prefer-standby":
		// do nothing
	default:
		return nil, &parseConfigError{
			connString: connString, msg: fmt.Sprintf("unknown target_session_attrs value: %v", tsa),
		}
	}
	return config, nil
}

func mergeSettings(settingSets ...map[string]string) map[string]string {
	settings := make(map[string]string)

	for _, s2 := range settingSets {
		for k, v := range s2 {
			settings[k] = v
		}
	}

	return settings
}

func parseEnvSettings() map[string]string {
	settings := make(map[string]string)

	nameMap := map[string]string{
		"PGHOST":               paramHost,
		"PGPORT":               paramPort,
		"PGDATABASE":           paramDatabase,
		"PGUSER":               paramUser,
		"PGPASSWORD":           paramPassword,
		"PGPASSFILE":           paramPassFile,
		"PGAPPNAME":            paramApplicationName,
		"PGCONNECT_TIMEOUT":    paramConnectTimeout,
		"PGSSLMODE":            paramSSLMode,
		"PGSSLKEY":             paramSSLKey,
		"PGSSLCERT":            paramSSLCert,
		"PGSSLROOTCERT":        paramSSLRootCert,
		"PGTARGETSESSIONATTRS": paramTargetSessionAttrs,
		"PGSERVICE":            paramService,
		"PGSERVICEFILE":        paramServiceFile,
		"PGLOGGERLEVEL":        paramCpBufferSize,
	}

	for envName, realName := range nameMap {
		value := os.Getenv(envName)
		if value != "" {
			settings[realName] = value
		}
	}

	return settings
}

func ParseURLToMap(connString string) (map[string]string, error) {
	connStringSettings := make(map[string]string)
	if connString == "" {
		return connStringSettings, nil
	}
	var err error
	// connString may be a database URL or a DSN
	if strings.HasPrefix(connString, "postgres://") || strings.HasPrefix(connString, "postgresql://") ||
		strings.HasPrefix(connString, "opengauss://") || strings.HasPrefix(connString, "mogdb://") {
		connStringSettings, err = parseURLSettings(connString)
		if err != nil {
			return nil, &parseConfigError{connString: connString, msg: "failed to parse as URL", err: err}
		}
	} else {
		connStringSettings, err = parseDSNSettings(connString)
		if err != nil {
			return nil, &parseConfigError{connString: connString, msg: "failed to parse as DSN", err: err}
		}
	}
	return connStringSettings, nil
}

func parseURLSettings(connString string) (map[string]string, error) {
	settings := make(map[string]string)

	urlParse, err := url.Parse(connString)
	if err != nil {
		return nil, err
	}

	if urlParse.User != nil {
		settings[paramUser] = urlParse.User.Username()
		if password, present := urlParse.User.Password(); present {
			settings[paramPassword] = password
		}
	}

	// Handle multiple host:port's in url.Host by splitting them into host,host,host and port,port,port.
	var hosts []string
	var ports []string
	for _, host := range strings.Split(urlParse.Host, ",") {
		if host == "" {
			continue
		}
		if isIPOnly(host) {
			hosts = append(hosts, strings.Trim(host, "[]"))
			continue
		}
		h, p, err := net.SplitHostPort(host)
		if err != nil {
			return nil, fmt.Errorf("failed to split host:port in '%s', err: %w", host, err)
		}
		hosts = append(hosts, h)
		ports = append(ports, p)
	}
	if len(hosts) > 0 {
		settings[paramHost] = strings.Join(hosts, ",")
	}
	if len(ports) > 0 {
		settings[paramPort] = strings.Join(ports, ",")
	}

	database := strings.TrimLeft(urlParse.Path, "/")
	if database != "" {
		settings[paramDatabase] = database
	}

	for k, v := range urlParse.Query() {
		settings[k] = v[0]
	}

	return settings, nil
}

func isIPOnly(host string) bool {
	return net.ParseIP(strings.Trim(host, "[]")) != nil || !strings.Contains(host, ":")
}

var asciiSpace = [256]uint8{'\t': 1, '\n': 1, '\v': 1, '\f': 1, '\r': 1, ' ': 1}

func parseDSNSettings(s string) (map[string]string, error) {
	settings := make(map[string]string)

	nameMap := map[string]string{
		"dbname": paramDatabase,
	}

	for len(s) > 0 {
		var key, val string
		eqIdx := strings.IndexRune(s, '=')
		if eqIdx < 0 {
			return nil, errors.New("invalid dsn")
		}

		key = strings.Trim(s[:eqIdx], " \t\n\r\v\f")
		s = strings.TrimLeft(s[eqIdx+1:], " \t\n\r\v\f")
		if len(s) == 0 {
		} else if s[0] != '\'' {
			end := 0
			for ; end < len(s); end++ {
				if asciiSpace[s[end]] == 1 {
					break
				}
				if s[end] == '\\' {
					end++
					if end == len(s) {
						return nil, errors.New("invalid backslash")
					}
				}
			}
			val = strings.Replace(strings.Replace(s[:end], "\\\\", "\\", -1), "\\'", "'", -1)
			if end == len(s) {
				s = ""
			} else {
				s = s[end+1:]
			}
		} else { // quoted string
			s = s[1:]
			end := 0
			for ; end < len(s); end++ {
				if s[end] == '\'' {
					break
				}
				if s[end] == '\\' {
					end++
				}
			}
			if end == len(s) {
				return nil, errors.New("unterminated quoted string in connection info string")
			}
			val = strings.Replace(strings.Replace(s[:end], "\\\\", "\\", -1), "\\'", "'", -1)
			if end == len(s) {
				s = ""
			} else {
				s = s[end+1:]
			}
		}

		if k, ok := nameMap[key]; ok {
			key = k
		}

		if key == "" {
			return nil, errors.New("invalid dsn")
		}

		settings[key] = val
	}

	return settings, nil
}

func parseServiceSettings(serviceFilePath, serviceName string) (map[string]string, error) {
	serviceFile, err := pgservicefile.ReadServiceFile(serviceFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read service file: %v", serviceFilePath)
	}

	service, err := serviceFile.GetService(serviceName)
	if err != nil {
		return nil, fmt.Errorf("unable to find service: %v", serviceName)
	}

	nameMap := map[string]string{
		"dbname": paramDatabase,
	}

	settings := make(map[string]string, len(service.Settings))
	for k, v := range service.Settings {
		if k2, present := nameMap[k]; present {
			k = k2
		}
		settings[k] = v
	}

	return settings, nil
}

func configGssAPI(settings map[string]string) (map[string]string, error) {
	gssAPIParams := map[string]string{
		paramKrbSrvName: settings[paramKrbSrvName],
		paramKrbSpn:     settings[paramKrbSpn],
	}
	return gssAPIParams, nil
}

func parsePort(s string) (uint16, error) {
	port, err := strconv.ParseUint(s, 10, 16)
	if err != nil {
		return 0, err
	}
	if port < 1 || port > math.MaxUint16 {
		return 0, errors.New("outside range")
	}
	return uint16(port), nil
}

func makeDefaultDialer() *net.Dialer {
	return &net.Dialer{KeepAlive: 5 * time.Minute}
}

func makeDefaultResolver() *net.Resolver {
	return net.DefaultResolver
}

func parseConnectTimeoutSetting(s string) (time.Duration, error) {
	timeout, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, err
	}
	if timeout < 0 {
		return 0, errors.New("negative timeout")
	}
	return time.Duration(timeout) * time.Second, nil
}

func makeConnectTimeoutDialFunc(timeout time.Duration) DialFunc {
	d := makeDefaultDialer()
	d.Timeout = timeout
	return d.DialContext
}
