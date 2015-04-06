// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package setting

import (
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/Unknwon/com"
	"github.com/macaron-contrib/session"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/log"
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
	AppName   string
	AppUrl    string
	AppSubUrl string

	// build
	BuildVersion string
	BuildCommit  string
	BuildStamp   int64

	// Log settings.
	LogRootPath string
	LogModes    []string
	LogConfigs  []string

	// Http server options
	Protocol           Scheme
	Domain             string
	HttpAddr, HttpPort string
	SshPort            int
	CertFile, KeyFile  string
	RouterLogging      bool
	StaticRootPath     string
	EnableGzip         bool

	// Security settings.
	SecretKey          string
	LogInRememberDays  int
	CookieUserName     string
	CookieRememberName string

	// User settings
	AllowUserSignUp    bool
	AllowUserOrgCreate bool
	AutoAssignOrg      bool
	AutoAssignOrgRole  string

	// Http auth
	AdminUser     string
	AdminPassword string

	AnonymousEnabled bool
	AnonymousOrgName string
	AnonymousOrgRole string

	// Session settings.
	SessionOptions session.Options

	// Global setting objects.
	WorkDir      string
	Cfg          *ini.File
	ConfRootPath string
	CustomPath   string // Custom directory path.
	ProdMode     bool
	RunUser      string
	IsWindows    bool

	// PhantomJs Rendering
	ImagesDir  string
	PhantomDir string

	configFiles []string

	ReportingEnabled  bool
	GoogleAnalyticsId string
)

func init() {
	IsWindows = runtime.GOOS == "windows"
	log.NewLogger(0, "console", `{"level": 0}`)
	WorkDir, _ = filepath.Abs(".")
}

func findConfigFiles(customConfigFile string) {
	ConfRootPath = path.Join(WorkDir, "conf")
	configFiles = make([]string, 0)

	configFile := path.Join(ConfRootPath, "defaults.ini")
	if com.IsFile(configFile) {
		configFiles = append(configFiles, configFile)
	}

	configFile = path.Join(ConfRootPath, "dev.ini")
	if com.IsFile(configFile) {
		configFiles = append(configFiles, configFile)
	}

	configFile = path.Join(ConfRootPath, "custom.ini")
	if com.IsFile(configFile) {
		configFiles = append(configFiles, configFile)
	}

	if customConfigFile != "" {
		configFiles = append(configFiles, customConfigFile)
	}

	if len(configFiles) == 0 {
		log.Fatal(3, "Could not find any config file")
	}
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

func loadEnvVariableOverrides() {
	for _, section := range Cfg.Sections() {
		for _, key := range section.Keys() {
			sectionName := strings.ToUpper(strings.Replace(section.Name(), ".", "_", -1))
			keyName := strings.ToUpper(strings.Replace(key.Name(), ".", "_", -1))
			envKey := fmt.Sprintf("GF_%s_%s", sectionName, keyName)
			envValue := os.Getenv(envKey)

			if len(envValue) > 0 {
				log.Info("Setting: ENV override found: %s", envKey)
				key.SetValue(envValue)
			}
		}
	}
}

func NewConfigContext(config string) {
	findConfigFiles(config)

	var err error

	for i, file := range configFiles {
		if i == 0 {
			Cfg, err = ini.Load(configFiles[i])
			Cfg.BlockMode = false
		} else {
			err = Cfg.Append(configFiles[i])
		}

		if err != nil {
			log.Fatal(4, "Fail to parse config file: %v, error: %v", file, err)
		}
	}

	loadEnvVariableOverrides()
	initLogging()

	AppName = Cfg.Section("").Key("app_name").MustString("Grafana")
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

	StaticRootPath = server.Key("static_root_path").MustString(path.Join(WorkDir, "webapp"))
	RouterLogging = server.Key("router_logging").MustBool(false)
	EnableGzip = server.Key("enable_gzip").MustBool(false)

	security := Cfg.Section("security")
	SecretKey = security.Key("secret_key").String()
	LogInRememberDays = security.Key("login_remember_days").MustInt()
	CookieUserName = security.Key("cookie_username").String()
	CookieRememberName = security.Key("cookie_remember_name").String()
	// admin
	AdminUser = security.Key("admin_user").String()
	AdminPassword = security.Key("admin_password").String()

	users := Cfg.Section("users")
	AllowUserSignUp = users.Key("allow_sign_up").MustBool(true)
	AllowUserOrgCreate = users.Key("allow_org_create").MustBool(true)
	AutoAssignOrg = users.Key("auto_assign_org").MustBool(true)
	AutoAssignOrgRole = users.Key("auto_assign_org_role").In("Editor", []string{"Editor", "Admin", "Viewer"})

	// anonymous access
	AnonymousEnabled = Cfg.Section("auth.anonymous").Key("enabled").MustBool(false)
	AnonymousOrgName = Cfg.Section("auth.anonymous").Key("org_name").String()
	AnonymousOrgRole = Cfg.Section("auth.anonymous").Key("org_role").String()

	// PhantomJS rendering
	ImagesDir = "data/png"
	PhantomDir = "vendor/phantomjs"

	analytics := Cfg.Section("analytics")
	ReportingEnabled = analytics.Key("reporting_enabled").MustBool(true)
	GoogleAnalyticsId = analytics.Key("google_analytics_ua_id").String()

	readSessionConfig()
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

	if SessionOptions.Provider == "file" {
		os.MkdirAll(path.Dir(SessionOptions.ProviderConfig), os.ModePerm)
	}
}

var logLevels = map[string]string{
	"Trace":    "0",
	"Debug":    "1",
	"Info":     "2",
	"Warn":     "3",
	"Error":    "4",
	"Critical": "5",
}

func initLogging() {
	// Get and check log mode.
	LogModes = strings.Split(Cfg.Section("log").Key("mode").MustString("console"), ",")
	LogRootPath = Cfg.Section("log").Key("root_path").MustString(path.Join(WorkDir, "/data/log"))
	LogConfigs = make([]string, len(LogModes))
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
			LogConfigs[i] = fmt.Sprintf(`{"level":%s}`, level)
		case "file":
			logPath := sec.Key("file_name").MustString(path.Join(LogRootPath, "grafana.log"))
			os.MkdirAll(path.Dir(logPath), os.ModePerm)
			LogConfigs[i] = fmt.Sprintf(
				`{"level":%s,"filename":"%s","rotate":%v,"maxlines":%d,"maxsize":%d,"daily":%v,"maxdays":%d}`, level,
				logPath,
				sec.Key("log_rotate").MustBool(true),
				sec.Key("max_lines").MustInt(1000000),
				1<<uint(sec.Key("max_size_shift").MustInt(28)),
				sec.Key("daily_rotate").MustBool(true),
				sec.Key("max_days").MustInt(7))
		case "conn":
			LogConfigs[i] = fmt.Sprintf(`{"level":%s,"reconnectOnMsg":%v,"reconnect":%v,"net":"%s","addr":"%s"}`, level,
				sec.Key("reconnect_on_msg").MustBool(),
				sec.Key("reconnect").MustBool(),
				sec.Key("protocol").In("tcp", []string{"tcp", "unix", "udp"}),
				sec.Key("addr").MustString(":7020"))
		case "smtp":
			LogConfigs[i] = fmt.Sprintf(`{"level":%s,"username":"%s","password":"%s","host":"%s","sendTos":"%s","subject":"%s"}`, level,
				sec.Key("user").MustString("example@example.com"),
				sec.Key("passwd").MustString("******"),
				sec.Key("host").MustString("127.0.0.1:25"),
				sec.Key("receivers").MustString("[]"),
				sec.Key("subject").MustString("Diagnostic message from serve"))
		case "database":
			LogConfigs[i] = fmt.Sprintf(`{"level":%s,"driver":"%s","conn":"%s"}`, level,
				sec.Key("driver").String(),
				sec.Key("conn").String())
		}

		log.NewLogger(Cfg.Section("log").Key("buffer_len").MustInt64(10000), mode, LogConfigs[i])
	}
}

func LogLoadedConfigFiles() {
	for _, file := range configFiles {
		log.Info("Config: Loaded from %s", file)
	}
}
