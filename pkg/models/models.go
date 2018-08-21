package models

type OAuthType int

const (
	GITHUB OAuthType = iota + 1
	GOOGLE
	TWITTER
	GENERIC
	GRAFANA_COM
	GITLAB
)
