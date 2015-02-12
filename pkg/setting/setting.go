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
	DisableUserSignUp  bool

	// single account
	SingleAccountMode  bool
	DefaultAccountName string
	DefaultAccountRole string

	// Http auth
	AdminUser     string
	AdminPassword string

	AnonymousEnabled     bool
	AnonymousAccountName string
	AnonymousAccountRole string

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
)

func init() {
	IsWindows = runtime.GOOS == "windows"
	log.NewLogger(0, "console", `{"level": 0}`)
	WorkDir, _ = filepath.Abs(".")
}

func findConfigFiles() []string {
	ConfRootPath = path.Join(WorkDir, "conf")
	filenames := make([]string, 0)

	configFile := path.Join(ConfRootPath, "grafana.ini")
	if com.IsFile(configFile) {
		filenames = append(filenames, configFile)
	}

	configFile = path.Join(ConfRootPath, "grafana.dev.ini")
	if com.IsFile(configFile) {
		filenames = append(filenames, configFile)
	}

	configFile = path.Join(ConfRootPath, "grafana.custom.ini")
	if com.IsFile(configFile) {
		filenames = append(filenames, configFile)
	}

	if len(filenames) == 0 {
		log.Fatal(3, "Could not find any config file")
	}

	return filenames
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

func NewConfigContext() {
	configFiles := findConfigFiles()

	//log.Info("Loading config files: %v", configFiles)
	var err error

	for i, file := range configFiles {
		if i == 0 {
			Cfg, err = ini.Load(configFiles[i])
		} else {
			err = Cfg.Append(configFiles[i])
		}

		if err != nil {
			log.Fatal(4, "Fail to parse config file: %v, error: %v", file, err)
		}
	}

	loadEnvVariableOverrides()

	AppName = Cfg.Section("").Key("app_name").MustString("Grafana")
	Env = Cfg.Section("").Key("app_mode").MustString("development")

	server := Cfg.Section("server")
	AppUrl, AppSubUrl = parseAppUrlAndSubUrl(server)

	Protocol = HTTP
	if server.Key("protocol").MustString("http") == "https" {
		Protocol = HTTPS
		CertFile = server.Key("cert_file").String()
		KeyFile = server.Key("cert_file").String()
	}

	Domain = server.Key("domain").MustString("localhost")
	HttpAddr = server.Key("http_addr").MustString("0.0.0.0")
	HttpPort = server.Key("http_port").MustString("3000")

	port := os.Getenv("PORT")
	if port != "" {
		HttpPort = port
	}

	StaticRootPath = server.Key("static_root_path").MustString(path.Join(WorkDir, "webapp"))
	RouterLogging = server.Key("router_logging").MustBool(false)
	EnableGzip = server.Key("enable_gzip").MustBool(false)

	security := Cfg.Section("security")
	SecretKey = security.Key("secret_key").String()
	LogInRememberDays = security.Key("login_remember_days").MustInt()
	CookieUserName = security.Key("cookie_username").String()
	CookieRememberName = security.Key("cookie_remember_name").String()
	DisableUserSignUp = security.Key("disable_user_signup").MustBool(false)

	// admin
	AdminUser = security.Key("admin_user").String()
	AdminPassword = security.Key("admin_password").String()

	// single account
	SingleAccountMode = Cfg.Section("account.single").Key("enabled").MustBool(false)
	DefaultAccountName = Cfg.Section("account.single").Key("account_name").MustString("main")
	DefaultAccountRole = Cfg.Section("account.single").Key("default_role").In("Editor", []string{"Editor", "Admin", "Viewer"})

	// anonymous access
	AnonymousEnabled = Cfg.Section("auth.anonymous").Key("enabled").MustBool(false)
	AnonymousAccountName = Cfg.Section("auth.anonymous").Key("account_name").String()
	AnonymousAccountRole = Cfg.Section("auth.anonymous").Key("account_role").String()

	// PhantomJS rendering
	ImagesDir = "data/png"
	PhantomDir = "vendor/phantomjs"

	LogRootPath = Cfg.Section("log").Key("root_path").MustString(path.Join(WorkDir, "/data/log"))

	readSessionConfig()
}

func readSessionConfig() {
	sec := Cfg.Section("session")
	SessionOptions = session.Options{}
	SessionOptions.Provider = sec.Key("provider").In("memory", []string{"memory", "file", "redis", "mysql"})
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
