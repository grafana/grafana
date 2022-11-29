package authn

import (
	"context"
	"net/http"
)

type Service interface {
	Authenticate(ctx context.Context, client string, r *Request) (*Identity, error)
}

type Client interface {
	Authenticate(ctx context.Context, r *Request) (*Identity, error)
}

type Request struct {
	HTTPRequest *http.Request
}

type Identity struct {
}
