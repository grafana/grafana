package models

import "errors"

type OAuthType int

const (
	GITHUB OAuthType = iota + 1
	GOOGLE
	TWITTER
)

var ErrNotFound = errors.New("Not found")
