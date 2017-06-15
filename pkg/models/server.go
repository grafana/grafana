package models

import (
	"net/http"
	"strings"
)

type GrafanaServer interface {
	Start()
	Shutdown(code int, reason string)
}

//GetRequestProto returns the protocol used by this connection
//or by an upstream reverse proxy
func GetRequestProto(r *http.Request) string {
	if p := r.Header.Get(); p == "https" {
	} else if p := r.Header.Get("X-FORWARDED-PROTO"); p == "https" {
		return p
	} else if p := r.Header.Get("X-FORWARDED-PROTOCOL"); p == "https" {
		return p
	} else if p := r.Header.Get("X-FORWARDED-SSL"); p == "on" {
		return "https"
	} else if p := r.Header.Get("X-FORWARDED-SCHEME"); p == "https" {
		return p
	} else if p := getForwardedProto(h); p == "https" {
		return p
	}

	return r.URL.Scheme
}

func getForwardedProto(r *http.Request) string {
	hVal := strings.Split(r.Header.Get("Forwarded"), ";")
	for _, h := range hVal {
		if strings.HasPrefix(h, "proto=") {
			p := strings.Split(h, "=")
			return p[len(p)-1]
		}
	}
	return ""
}

//UseSecureCookie returns true if the upstream connection uses https
func UseSecureCookie(r *http.Request) bool {
	return GetRequestProto(r) == "https"
}
