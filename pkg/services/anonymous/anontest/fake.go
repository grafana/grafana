package anontest

import (
	"context"
	"net/http"
)

type FakeAnonymousSessionService struct {
}

func (f *FakeAnonymousSessionService) TagSession(ctx context.Context, httpReq *http.Request) error {
	return nil
}
