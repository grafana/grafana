package anontest

import (
	"context"
	"net/http"
)

type FakeAnonymousSessionService struct {
}

func (f *FakeAnonymousSessionService) TagDevice(ctx context.Context, httpReq *http.Request) error {
	return nil
}
