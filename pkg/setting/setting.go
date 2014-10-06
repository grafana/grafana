// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package setting

import (
	"net/url"
	"os"
	"os/exec"
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

var (
	// App settings.
	AppVer    string
	AppName   string
	AppUrl    string
	AppSubUrl string

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

	// Session settings.
	SessionProvider string
	SessionConfig   *session.Config

	// Global setting objects.
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

// WorkDir returns absolute path of work directory.
func WorkDir() (string, error) {
	execPath, err := ExecPath()
	return path.Dir(strings.Replace(execPath, "\\", "/", -1)), err
}

func ExecPath() (string, error) {
	file, err := exec.LookPath(os.Args[0])
	if err != nil {
		return "", err
	}
	p, err := filepath.Abs(file)
	if err != nil {
		return "", err
	}
	return p, nil
}

func NewConfigContext() {
	workDir, err := WorkDir()
	if err != nil {
		log.Fatal(4, "Fail to get work directory: %v", err)
	}
	ConfRootPath = path.Join(workDir, "conf")

	Cfg, err = goconfig.LoadConfigFile(path.Join(workDir, "conf/grafana.ini"))
	if err != nil {
		log.Fatal(4, "Fail to parse 'conf/grafana.ini': %v", err)
	}

	CustomPath = os.Getenv("GRAFANA_CONF")

	if len(CustomPath) == 0 {
		CustomPath = path.Join(workDir, "custom")
	}

	cfgPath := path.Join(CustomPath, "conf/grafana.ini")
	if com.IsFile(cfgPath) {
		if err = Cfg.AppendFiles(cfgPath); err != nil {
			log.Fatal(4, "Fail to load custom 'conf/grafana.ini': %v", err)
		}
	} else {
		log.Warn("No custom 'conf/grafana.ini'")
	}

	AppName = Cfg.MustValue("", "app_name", "Grafana Pro")
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

	StaticRootPath = Cfg.MustValue("server", "static_root_path", workDir)
	RouterLogging = Cfg.MustBool("server", "router_logging", false)

	// PhantomJS rendering
	ImagesDir = "data/png"
	PhantomDir = "_vendor/phantomjs"
}

func initSessionService() {
	SessionProvider = Cfg.MustValueRange("session", "provider", "memory", []string{"memory", "file"})

	SessionConfig = new(session.Config)
	SessionConfig.ProviderConfig = strings.Trim(Cfg.MustValue("session", "provider_config"), "\" ")
	SessionConfig.CookieName = Cfg.MustValue("session", "cookie_name", "grafana_pro_sess")
	SessionConfig.CookiePath = AppSubUrl
	SessionConfig.Secure = Cfg.MustBool("session", "cookie_secure")
	SessionConfig.EnableSetCookie = Cfg.MustBool("session", "enable_set_cookie", true)
	SessionConfig.Gclifetime = Cfg.MustInt64("session", "gc_interval_time", 86400)
	SessionConfig.Maxlifetime = Cfg.MustInt64("session", "session_life_time", 86400)
	SessionConfig.SessionIDHashFunc = Cfg.MustValueRange("session", "session_id_hashfunc",
		"sha1", []string{"sha1", "sha256", "md5"})
	SessionConfig.SessionIDHashKey = Cfg.MustValue("session", "session_id_hashkey", string(com.RandomCreateBytes(16)))

	if SessionProvider == "file" {
		os.MkdirAll(path.Dir(SessionConfig.ProviderConfig), os.ModePerm)
	}

	log.Info("Session Service Enabled")
}

func InitServices() {
	initSessionService()
}
