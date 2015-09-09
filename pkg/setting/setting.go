// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package setting

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	"github.com/macaron-contrib/session"
	"gopkg.in/ini.v1"

	"github.com/Cepave/grafana/pkg/log"
	"github.com/Cepave/grafana/pkg/util"
)

type Scheme string

const (
	HTTP  Scheme = "http"
	HTTPS Scheme = "https"
)

const (
	DEV  string = "development"
	PROD string = "production"
	TEST string = "test"
)

var (
	// App settings.
	Env       string = DEV
	AppUrl    string
	AppSubUrl string

	// build
	BuildVersion string
	BuildCommit  string
	BuildStamp   int64

	// Paths
	LogsPath string
	HomePath string
	DataPath string

	// Log settings.
	LogModes   []string
	LogConfigs []util.DynMap

	// Http server options
	Protocol           Scheme
	Domain             string
	HttpAddr, HttpPort string
	SshPort            int
	CertFile, KeyFile  string
	RouterLogging      bool
	StaticRootPath     string
	EnableGzip         bool
	EnforceDomain      bool

	// Security settings.
	SecretKey             string
	LogInRememberDays     int
	CookieUserName        string
	CookieRememberName    string
	DisableGravatar       bool
	EmailCodeValidMinutes int
	DataProxyWhiteList    map[string]bool

	// User settings
<<<<<<< 480b120d4e1187bc8acaa8d22f3daffed4cb5a49
<<<<<<< aaf45d229a76bf7461b0e22adf2a0fddb6c4a352
=======
>>>>>>> feat(signup): almost done with new sign up flow, #2353
	AllowUserSignUp    bool
	AllowUserOrgCreate bool
	AutoAssignOrg      bool
	AutoAssignOrgRole  string
	VerifyEmailEnabled bool
<<<<<<< 480b120d4e1187bc8acaa8d22f3daffed4cb5a49
=======
	AllowUserSignUp        bool
	AllowUserOrgCreate     bool
	AutoAssignOrg          bool
	AutoAssignOrgRole      string
	RequireEmailValidation bool
>>>>>>> feat(signup): began work on new / alternate signup flow that includes email verification, #2353
=======
>>>>>>> feat(signup): almost done with new sign up flow, #2353

	// Http auth
	AdminUser     string
	AdminPassword string

	AnonymousEnabled bool
	AnonymousOrgName string
	AnonymousOrgRole string

	// Auth proxy settings
	AuthProxyEnabled        bool
	AuthProxyHeaderName     string
	AuthProxyHeaderProperty string
	AuthProxyAutoSignUp     bool

	// Basic Auth
	BasicAuthEnabled bool

	// Session settings.
	SessionOptions session.Options

	// Global setting objects.
	Cfg          *ini.File
	ConfRootPath string
	IsWindows    bool

	// PhantomJs Rendering
	ImagesDir  string
	PhantomDir string

	// for logging purposes
	configFiles                  []string
	appliedCommandLineProperties []string
	appliedEnvOverrides          []string

	ReportingEnabled   bool
	GoogleAnalyticsId  string
	GoogleTagManagerId string

	// LDAP
	LdapEnabled    bool
	LdapConfigFile string

	// SMTP email settings
	Smtp SmtpSettings

	// QUOTA
	Quota QuotaSettings
)

type CommandLineArgs struct {
	Config   string
	HomePath string
	Args     []string
}

func init() {
	IsWindows = runtime.GOOS == "windows"
	log.NewLogger(0, "console", `{"level": 0, "formatting":true}`)
}

func parseAppUrlAndSubUrl(section *ini.Section) (string, string) {
	appUrl := section.Key("root_url").MustString("http://localhost:3000/")
	if appUrl[len(appUrl)-1] != '/' {
		appUrl += "/"
	}

	// Check if has app suburl.
	url, err := url.Parse(appUrl)
	if err != nil {
		log.Fatal(4, "Invalid root_url(%s): %s", appUrl, err)
	}
	appSubUrl := strings.TrimSuffix(url.Path, "/")

	return appUrl, appSubUrl
}

func ToAbsUrl(relativeUrl string) string {
	return AppUrl + relativeUrl
}

func applyEnvVariableOverrides() {
	appliedEnvOverrides = make([]string, 0)
	for _, section := range Cfg.Sections() {
		for _, key := range section.Keys() {
			sectionName := strings.ToUpper(strings.Replace(section.Name(), ".", "_", -1))
			keyName := strings.ToUpper(strings.Replace(key.Name(), ".", "_", -1))
			envKey := fmt.Sprintf("GF_%s_%s", sectionName, keyName)
			envValue := os.Getenv(envKey)

			if len(envValue) > 0 {
				key.SetValue(envValue)
				appliedEnvOverrides = append(appliedEnvOverrides, fmt.Sprintf("%s=%s", envKey, envValue))
			}
		}
	}
}

func applyCommandLineDefaultProperties(props map[string]string) {
	appliedCommandLineProperties = make([]string, 0)
	for _, section := range Cfg.Sections() {
		for _, key := range section.Keys() {
			keyString := fmt.Sprintf("default.%s.%s", section.Name(), key.Name())
			value, exists := props[keyString]
			if exists {
				key.SetValue(value)
				appliedCommandLineProperties = append(appliedCommandLineProperties, fmt.Sprintf("%s=%s", keyString, value))
			}
		}
	}
}

func applyCommandLineProperties(props map[string]string) {
	for _, section := range Cfg.Sections() {
		for _, key := range section.Keys() {
			keyString := fmt.Sprintf("%s.%s", section.Name(), key.Name())
			value, exists := props[keyString]
			if exists {
				key.SetValue(value)
				appliedCommandLineProperties = append(appliedCommandLineProperties, fmt.Sprintf("%s=%s", keyString, value))
			}
		}
	}
}

func getCommandLineProperties(args []string) map[string]string {
	props := make(map[string]string)

	for _, arg := range args {
		if !strings.HasPrefix(arg, "cfg:") {
			continue
		}

		trimmed := strings.TrimPrefix(arg, "cfg:")
		parts := strings.Split(trimmed, "=")
		if len(parts) != 2 {
			log.Fatal(3, "Invalid command line argument", arg)
			return nil
		}

		props[parts[0]] = parts[1]
	}
	return props
}

func makeAbsolute(path string, root string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(root, path)
}

func evalEnvVarExpression(value string) string {
	regex := regexp.MustCompile(`\${(\w+)}`)
	return regex.ReplaceAllStringFunc(value, func(envVar string) string {
		envVar = strings.TrimPrefix(envVar, "${")
		envVar = strings.TrimSuffix(envVar, "}")
		envValue := os.Getenv(envVar)
		return envValue
	})
}

func evalConfigValues() {
	for _, section := range Cfg.Sections() {
		for _, key := range section.Keys() {
			key.SetValue(evalEnvVarExpression(key.Value()))
		}
	}
}

func loadSpecifedConfigFile(configFile string) {
	if configFile == "" {
		configFile = filepath.Join(HomePath, "conf/custom.ini")
		// return without error if custom file does not exist
		if !pathExists(configFile) {
			return
		}
	}

	userConfig, err := ini.Load(configFile)
	userConfig.BlockMode = false
	if err != nil {
		log.Fatal(3, "Failed to parse %v, %v", configFile, err)
	}

	for _, section := range userConfig.Sections() {
		for _, key := range section.Keys() {
			if key.Value() == "" {
				continue
			}

			defaultSec, err := Cfg.GetSection(section.Name())
			if err != nil {
				log.Error(3, "Unknown config section %s defined in %s", section.Name(), configFile)
				continue
			}
			defaultKey, err := defaultSec.GetKey(key.Name())
			if err != nil {
				log.Error(3, "Unknown config key %s defined in section %s, in file %s", key.Name(), section.Name(), configFile)
				continue
			}
			defaultKey.SetValue(key.Value())
		}
	}

	configFiles = append(configFiles, configFile)
}

func loadConfiguration(args *CommandLineArgs) {
	var err error

	// load config defaults
	defaultConfigFile := path.Join(HomePath, "conf/defaults.ini")
	configFiles = append(configFiles, defaultConfigFile)

	Cfg, err = ini.Load(defaultConfigFile)
	Cfg.BlockMode = false

	if err != nil {
		log.Fatal(3, "Failed to parse defaults.ini, %v", err)
	}

	// command line props
	commandLineProps := getCommandLineProperties(args.Args)
	// load default overrides
	applyCommandLineDefaultProperties(commandLineProps)

	// init logging before specific config so we can log errors from here on
	DataPath = makeAbsolute(Cfg.Section("paths").Key("data").String(), HomePath)
	initLogging(args)

	// load specified config file
	loadSpecifedConfigFile(args.Config)

	// apply environment overrides
	applyEnvVariableOverrides()

	// apply command line overrides
	applyCommandLineProperties(commandLineProps)

	// evaluate config values containing environment variables
	evalConfigValues()

	// update data path and logging config
	DataPath = makeAbsolute(Cfg.Section("paths").Key("data").String(), HomePath)
	initLogging(args)
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	if err == nil {
		return true
	}
	if os.IsNotExist(err) {
		return false
	}
	return false
}

func setHomePath(args *CommandLineArgs) {
	if args.HomePath != "" {
		HomePath = args.HomePath
		return
	}

	HomePath, _ = filepath.Abs(".")
	// check if homepath is correct
	if pathExists(filepath.Join(HomePath, "conf/defaults.ini")) {
		return
	}

	// try down one path
	if pathExists(filepath.Join(HomePath, "../conf/defaults.ini")) {
		HomePath = filepath.Join(HomePath, "../")
	}
}

var skipStaticRootValidation bool = false

func validateStaticRootPath() error {
	if skipStaticRootValidation {
		return nil
	}

	if _, err := os.Stat(path.Join(StaticRootPath, "css")); err == nil {
		return nil
	}

	if _, err := os.Stat(StaticRootPath + "_gen/css"); err == nil {
		StaticRootPath = StaticRootPath + "_gen"
		return nil
	}

	return errors.New("Failed to detect generated css or javascript files in static root (%s), have you executed default grunt task?")
}

func NewConfigContext(args *CommandLineArgs) error {
	setHomePath(args)
	loadConfiguration(args)

	Env = Cfg.Section("").Key("app_mode").MustString("development")

	server := Cfg.Section("server")
	AppUrl, AppSubUrl = parseAppUrlAndSubUrl(server)

	Protocol = HTTP
	if server.Key("protocol").MustString("http") == "https" {
		Protocol = HTTPS
		CertFile = server.Key("cert_file").String()
		KeyFile = server.Key("cert_key").String()
	}

	Domain = server.Key("domain").MustString("localhost")
	HttpAddr = server.Key("http_addr").MustString("0.0.0.0")
	HttpPort = server.Key("http_port").MustString("3000")
	RouterLogging = server.Key("router_logging").MustBool(false)
	EnableGzip = server.Key("enable_gzip").MustBool(false)
	EnforceDomain = server.Key("enforce_domain").MustBool(false)
	StaticRootPath = makeAbsolute(server.Key("static_root_path").String(), HomePath)

<<<<<<< 2f1438800f66d353ba27af074d29b3439f6ba16a
	if err := validateStaticRootPath(); err != nil {
		return err
	}

=======
>>>>>>> feat(dataproxy): added whitelist setting and feature for data proxies, closes #2626
	// read security settings
	security := Cfg.Section("security")
	SecretKey = security.Key("secret_key").String()
	LogInRememberDays = security.Key("login_remember_days").MustInt()
	CookieUserName = security.Key("cookie_username").String()
	CookieRememberName = security.Key("cookie_remember_name").String()
	DisableGravatar = security.Key("disable_gravatar").MustBool(true)

	//  read data source proxy white list
	DataProxyWhiteList = make(map[string]bool)
	for _, hostAndIp := range security.Key("data_source_proxy_whitelist").Strings(" ") {
		DataProxyWhiteList[hostAndIp] = true
	}

	// admin
	AdminUser = security.Key("admin_user").String()
	AdminPassword = security.Key("admin_password").String()

	users := Cfg.Section("users")
	AllowUserSignUp = users.Key("allow_sign_up").MustBool(true)
	AllowUserOrgCreate = users.Key("allow_org_create").MustBool(true)
	AutoAssignOrg = users.Key("auto_assign_org").MustBool(true)
	AutoAssignOrgRole = users.Key("auto_assign_org_role").In("Editor", []string{"Editor", "Admin", "Read Only Editor", "Viewer"})
	VerifyEmailEnabled = users.Key("verify_email_enabled").MustBool(false)

	// anonymous access
	AnonymousEnabled = Cfg.Section("auth.anonymous").Key("enabled").MustBool(false)
	AnonymousOrgName = Cfg.Section("auth.anonymous").Key("org_name").String()
	AnonymousOrgRole = Cfg.Section("auth.anonymous").Key("org_role").String()

	// auth proxy
	authProxy := Cfg.Section("auth.proxy")
	AuthProxyEnabled = authProxy.Key("enabled").MustBool(false)
	AuthProxyHeaderName = authProxy.Key("header_name").String()
	AuthProxyHeaderProperty = authProxy.Key("header_property").String()
	AuthProxyAutoSignUp = authProxy.Key("auto_sign_up").MustBool(true)

	authBasic := Cfg.Section("auth.basic")
	BasicAuthEnabled = authBasic.Key("enabled").MustBool(true)

	// PhantomJS rendering
	ImagesDir = filepath.Join(DataPath, "png")
	PhantomDir = filepath.Join(HomePath, "vendor/phantomjs")

	analytics := Cfg.Section("analytics")
	ReportingEnabled = analytics.Key("reporting_enabled").MustBool(true)
	GoogleAnalyticsId = analytics.Key("google_analytics_ua_id").String()
	GoogleTagManagerId = analytics.Key("google_tag_manager_id").String()

	ldapSec := Cfg.Section("auth.ldap")
	LdapEnabled = ldapSec.Key("enabled").MustBool(false)
	LdapConfigFile = ldapSec.Key("config_file").String()

	readSessionConfig()
	readSmtpSettings()
<<<<<<< 480b120d4e1187bc8acaa8d22f3daffed4cb5a49
	readQuotaSettings()
=======
>>>>>>> feat(signup): almost done with new sign up flow, #2353

	if VerifyEmailEnabled && !Smtp.Enabled {
		log.Warn("require_email_validation is enabled but smpt is disabled")
	}
<<<<<<< 480b120d4e1187bc8acaa8d22f3daffed4cb5a49

	return nil
=======
>>>>>>> feat(signup): almost done with new sign up flow, #2353
}

func readSessionConfig() {
	sec := Cfg.Section("session")
	SessionOptions = session.Options{}
	SessionOptions.Provider = sec.Key("provider").In("memory", []string{"memory", "file", "redis", "mysql", "postgres"})
	SessionOptions.ProviderConfig = strings.Trim(sec.Key("provider_config").String(), "\" ")
	SessionOptions.CookieName = sec.Key("cookie_name").MustString("grafana_sess")
	SessionOptions.CookiePath = AppSubUrl
	SessionOptions.Secure = sec.Key("cookie_secure").MustBool()
	SessionOptions.Gclifetime = Cfg.Section("session").Key("gc_interval_time").MustInt64(86400)
	SessionOptions.Maxlifetime = Cfg.Section("session").Key("session_life_time").MustInt64(86400)
	SessionOptions.IDLength = 16

	if SessionOptions.Provider == "file" {
		SessionOptions.ProviderConfig = makeAbsolute(SessionOptions.ProviderConfig, DataPath)
		os.MkdirAll(path.Dir(SessionOptions.ProviderConfig), os.ModePerm)
	}

	if SessionOptions.CookiePath == "" {
		SessionOptions.CookiePath = "/"
	}
}

var logLevels = map[string]int{
	"Trace":    0,
	"Debug":    1,
	"Info":     2,
	"Warn":     3,
	"Error":    4,
	"Critical": 5,
}

func initLogging(args *CommandLineArgs) {
	//close any existing log handlers.
	log.Close()
	// Get and check log mode.
	LogModes = strings.Split(Cfg.Section("log").Key("mode").MustString("console"), ",")
	LogsPath = makeAbsolute(Cfg.Section("paths").Key("logs").String(), HomePath)

	LogConfigs = make([]util.DynMap, len(LogModes))
	for i, mode := range LogModes {
		mode = strings.TrimSpace(mode)
		sec, err := Cfg.GetSection("log." + mode)
		if err != nil {
			log.Fatal(4, "Unknown log mode: %s", mode)
		}

		// Log level.
		levelName := Cfg.Section("log."+mode).Key("level").In("Trace",
			[]string{"Trace", "Debug", "Info", "Warn", "Error", "Critical"})
		level, ok := logLevels[levelName]
		if !ok {
			log.Fatal(4, "Unknown log level: %s", levelName)
		}

		// Generate log configuration.
		switch mode {
		case "console":
			formatting := sec.Key("formatting").MustBool(true)
			LogConfigs[i] = util.DynMap{
				"level":      level,
				"formatting": formatting,
			}
		case "file":
			logPath := sec.Key("file_name").MustString(filepath.Join(LogsPath, "grafana.log"))
			os.MkdirAll(filepath.Dir(logPath), os.ModePerm)
			LogConfigs[i] = util.DynMap{
				"level":    level,
				"filename": logPath,
				"rotate":   sec.Key("log_rotate").MustBool(true),
				"maxlines": sec.Key("max_lines").MustInt(1000000),
				"maxsize":  1 << uint(sec.Key("max_size_shift").MustInt(28)),
				"daily":    sec.Key("daily_rotate").MustBool(true),
				"maxdays":  sec.Key("max_days").MustInt(7),
			}
		case "conn":
			LogConfigs[i] = util.DynMap{
				"level":          level,
				"reconnectOnMsg": sec.Key("reconnect_on_msg").MustBool(),
				"reconnect":      sec.Key("reconnect").MustBool(),
				"net":            sec.Key("protocol").In("tcp", []string{"tcp", "unix", "udp"}),
				"addr":           sec.Key("addr").MustString(":7020"),
			}
		case "smtp":
			LogConfigs[i] = util.DynMap{
				"level":     level,
				"user":      sec.Key("user").MustString("example@example.com"),
				"passwd":    sec.Key("passwd").MustString("******"),
				"host":      sec.Key("host").MustString("127.0.0.1:25"),
				"receivers": sec.Key("receivers").MustString("[]"),
				"subject":   sec.Key("subject").MustString("Diagnostic message from serve"),
			}
		case "database":
			LogConfigs[i] = util.DynMap{
				"level":  level,
				"driver": sec.Key("driver").String(),
				"conn":   sec.Key("conn").String(),
			}
		}

		cfgJsonBytes, _ := json.Marshal(LogConfigs[i])
		log.NewLogger(Cfg.Section("log").Key("buffer_len").MustInt64(10000), mode, string(cfgJsonBytes))
	}
}

func LogConfigurationInfo() {
	var text bytes.Buffer
	text.WriteString("Configuration Info\n")

	text.WriteString("Config files:\n")
	for i, file := range configFiles {
		text.WriteString(fmt.Sprintf("  [%d]: %s\n", i, file))
	}

	if len(appliedCommandLineProperties) > 0 {
		text.WriteString("Command lines overrides:\n")
		for i, prop := range appliedCommandLineProperties {
			text.WriteString(fmt.Sprintf("  [%d]: %s\n", i, prop))
		}
	}

	if len(appliedEnvOverrides) > 0 {
		text.WriteString("\tEnvironment variables used:\n")
		for i, prop := range appliedEnvOverrides {
			text.WriteString(fmt.Sprintf("  [%d]: %s\n", i, prop))
		}
	}

	text.WriteString("Paths:\n")
	text.WriteString(fmt.Sprintf("  home: %s\n", HomePath))
	text.WriteString(fmt.Sprintf("  data: %s\n", DataPath))
	text.WriteString(fmt.Sprintf("  logs: %s\n", LogsPath))

	log.Info(text.String())
}
