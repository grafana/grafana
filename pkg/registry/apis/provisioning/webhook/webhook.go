package webhook

import (
	"context"
	"log/slog"
	"net/http"

	"k8s.io/apiserver/pkg/registry/rest"
)

type Webhook interface {
	Handle(ctx context.Context, logger *slog.Logger, responder rest.Responder) http.HandlerFunc
}
