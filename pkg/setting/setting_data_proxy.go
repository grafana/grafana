package setting

import (
	"fmt"

	"gopkg.in/ini.v1"
)

const defaultDataProxyRowLimit = int64(1000000)

type ProxySettings struct {
	SendUserHeader        bool
	Logging               bool
	Timeout               int
	DialTimeout           int
	KeepAlive             int
	TLSHandshakeTimeout   int
	ExpectContinueTimeout int
	MaxConnsPerHost       int
	MaxIdleConns          int
	IdleConnTimeout       int
	ResponseLimit         int64
	RowLimit              int64
	UserAgent             string
}

func readDataProxySettings(iniFile *ini.File, cfg *Cfg) error {
	proxy := ReadDataProxySettings(iniFile)

	cfg.SendUserHeader = proxy.SendUserHeader
	cfg.DataProxyLogging = proxy.Logging
	cfg.DataProxyTimeout = proxy.Timeout
	cfg.DataProxyDialTimeout = proxy.DialTimeout
	cfg.DataProxyKeepAlive = proxy.KeepAlive
	cfg.DataProxyTLSHandshakeTimeout = proxy.TLSHandshakeTimeout
	cfg.DataProxyExpectContinueTimeout = proxy.ExpectContinueTimeout
	cfg.DataProxyMaxConnsPerHost = proxy.MaxConnsPerHost
	cfg.DataProxyMaxIdleConns = proxy.MaxIdleConns
	cfg.DataProxyIdleConnTimeout = proxy.IdleConnTimeout
	cfg.ResponseLimit = proxy.ResponseLimit
	cfg.DataProxyRowLimit = proxy.RowLimit
	cfg.DataProxyUserAgent = proxy.UserAgent

	return nil
}

func ReadDataProxySettings(iniFile *ini.File) ProxySettings {
	section := iniFile.Section("dataproxy")

	proxy := ProxySettings{
		SendUserHeader:        section.Key("send_user_header").MustBool(false),
		Logging:               section.Key("logging").MustBool(false),
		Timeout:               section.Key("timeout").MustInt(30),
		DialTimeout:           section.Key("dialTimeout").MustInt(10),
		KeepAlive:             section.Key("keep_alive_seconds").MustInt(30),
		TLSHandshakeTimeout:   section.Key("tls_handshake_timeout_seconds").MustInt(10),
		ExpectContinueTimeout: section.Key("expect_continue_timeout_seconds").MustInt(1),
		MaxConnsPerHost:       section.Key("max_conns_per_host").MustInt(0),
		MaxIdleConns:          section.Key("max_idle_connections").MustInt(),
		IdleConnTimeout:       section.Key("idle_conn_timeout_seconds").MustInt(90),
		ResponseLimit:         section.Key("response_limit").MustInt64(0),
		RowLimit:              section.Key("row_limit").MustInt64(defaultDataProxyRowLimit),
		UserAgent:             section.Key("user_agent").String(),
	}

	if proxy.UserAgent == "" {
		proxy.UserAgent = fmt.Sprintf("Grafana/%s", BuildVersion)
	}

	if proxy.RowLimit <= 0 {
		proxy.RowLimit = defaultDataProxyRowLimit
	}

	return proxy
}
