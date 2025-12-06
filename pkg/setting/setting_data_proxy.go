package setting

import (
	"fmt"

	"gopkg.in/ini.v1"
)

const defaultDataProxyRowLimit = int64(1000000)

type DataProxySettings struct {
	SendUserHeader        bool
	Logging               bool
	Timeout               int
	DialTimeout           int
	TLSHandshakeTimeout   int
	ExpectContinueTimeout int
	MaxConnsPerHost       int
	MaxIdleConns          int
	KeepAlive             int
	IdleConnTimeout       int
	ResponseLimit         int64
	RowLimit              int64
	UserAgent             string
}

func DataProxyFromINI(iniFile *ini.File) DataProxySettings {
	d := DataProxySettings{}

	dataproxy := iniFile.Section("dataproxy")
	d.SendUserHeader = dataproxy.Key("send_user_header").MustBool(false)
	d.Logging = dataproxy.Key("logging").MustBool(false)
	d.Timeout = dataproxy.Key("timeout").MustInt(30)
	d.DialTimeout = dataproxy.Key("dialTimeout").MustInt(10)
	d.KeepAlive = dataproxy.Key("keep_alive_seconds").MustInt(30)
	d.TLSHandshakeTimeout = dataproxy.Key("tls_handshake_timeout_seconds").MustInt(10)
	d.ExpectContinueTimeout = dataproxy.Key("expect_continue_timeout_seconds").MustInt(1)
	d.MaxConnsPerHost = dataproxy.Key("max_conns_per_host").MustInt(0)
	d.MaxIdleConns = dataproxy.Key("max_idle_connections").MustInt()
	d.IdleConnTimeout = dataproxy.Key("idle_conn_timeout_seconds").MustInt(90)
	d.ResponseLimit = dataproxy.Key("response_limit").MustInt64(0)
	d.RowLimit = dataproxy.Key("row_limit").MustInt64(defaultDataProxyRowLimit)
	d.UserAgent = dataproxy.Key("user_agent").String()

	if d.UserAgent == "" {
		d.UserAgent = fmt.Sprintf("Grafana/%s", BuildVersion)
	}

	if d.RowLimit <= 0 {
		d.RowLimit = defaultDataProxyRowLimit
	}

	return d
}

func readDataProxySettings(iniFile *ini.File, cfg *Cfg) error {
	dataProxySettings := DataProxyFromINI(iniFile)

	cfg.DataProxy = dataProxySettings

	return nil
}
