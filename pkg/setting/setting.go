// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package setting

import (
	"net/url"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/Unknwon/com"
	"github.com/Unknwon/goconfig"
	"github.com/macaron-contrib/session"

	"github.com/torkelo/grafana-pro/pkg/log"
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

	// Http auth
	AdminUser          string
	AdminPassword      string
	Anonymous          bool
	AnonymousAccountId int64

	// Session settings.
	SessionOptions session.Options

	// Global setting objects.
	WorkDir      string
	Cfg          *goconfig.ConfigFile
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
}

func getWorkDir() string {
	p, _ := filepath.Abs(".")
	return p
}

func findConfigFiles() []string {
	WorkDir = getWorkDir()
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

func NewConfigContext() {
	configFiles := findConfigFiles()

	//log.Info("Loading config files: %v", configFiles)
	var err error

	Cfg, err = goconfig.LoadConfigFile(configFiles[0])
	if err != nil {
		log.Fatal(4, "Fail to parse config file, error: %v", err)
	}

	if len(configFiles) > 1 {
		err = Cfg.AppendFiles(configFiles[1:]...)
		if err != nil {
			log.Fatal(4, "Fail to parse config file, error: %v", err)
		}
	}

	AppName = Cfg.MustValue("", "app_name", "Grafana")
	AppUrl = Cfg.MustValue("server", "root_url", "http://localhost:3000/")
	if AppUrl[len(AppUrl)-1] != '/' {
		AppUrl += "/"
	}

	// Check if has app suburl.
	url, err := url.Parse(AppUrl)
	if err != nil {
		log.Fatal(4, "Invalid root_url(%s): %s", AppUrl, err)
	}

	AppSubUrl = strings.TrimSuffix(url.Path, "/")

	Protocol = HTTP
	if Cfg.MustValue("server", "protocol") == "https" {
		Protocol = HTTPS
		CertFile = Cfg.MustValue("server", "cert_file")
		KeyFile = Cfg.MustValue("server", "key_file")
	}
	Domain = Cfg.MustValue("server", "domain", "localhost")
	HttpAddr = Cfg.MustValue("server", "http_addr", "0.0.0.0")
	HttpPort = Cfg.MustValue("server", "http_port", "3000")

	port := os.Getenv("PORT")
	if port != "" {
		HttpPort = port
	}

	StaticRootPath = Cfg.MustValue("server", "static_root_path", path.Join(WorkDir, "webapp"))
	RouterLogging = Cfg.MustBool("server", "router_logging", false)
	EnableGzip = Cfg.MustBool("server", "enable_gzip")

	// Http auth
	AdminUser = Cfg.MustValue("admin", "user", "admin")
	AdminPassword = Cfg.MustValue("admin", "password", "admin")
	Anonymous = Cfg.MustBool("auth", "anonymous", false)
	AnonymousAccountId = Cfg.MustInt64("auth", "anonymous_account_id", 0)

	if Anonymous && AnonymousAccountId == 0 {
		log.Fatal(3, "Must specify account id for anonymous access")
	}

	// PhantomJS rendering
	ImagesDir = "data/png"
	PhantomDir = "vendor/phantomjs"

	LogRootPath = Cfg.MustValue("log", "root_path", path.Join(WorkDir, "/data/log"))

	readSessionConfig()
}

func readSessionConfig() {
	SessionOptions = session.Options{}
	SessionOptions.Provider = Cfg.MustValueRange("session", "provider", "memory", []string{"memory", "file"})
	SessionOptions.ProviderConfig = strings.Trim(Cfg.MustValue("session", "provider_config"), "\" ")
	SessionOptions.CookieName = Cfg.MustValue("session", "cookie_name", "grafana_pro_sess")
	SessionOptions.CookiePath = AppSubUrl
	SessionOptions.Secure = Cfg.MustBool("session", "cookie_secure")
	SessionOptions.Gclifetime = Cfg.MustInt64("session", "gc_interval_time", 86400)
	SessionOptions.Maxlifetime = Cfg.MustInt64("session", "session_life_time", 86400)

	if SessionOptions.Provider == "file" {
		os.MkdirAll(path.Dir(SessionOptions.ProviderConfig), os.ModePerm)
	}

	log.Info("Session Service Enabled")
}
