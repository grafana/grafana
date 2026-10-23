package rendering

import "context"

type UserAgentProvider interface {
	UserAgent(context.Context) (string, error)
}

type StaticUserAgent string

func (s StaticUserAgent) UserAgent(context.Context) (string, error) { return string(s), nil }
