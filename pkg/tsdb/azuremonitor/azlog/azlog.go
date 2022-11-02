package azlog

import (
	"context"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

var (
	azlog = log.New("tsdb.azuremonitor")
)

func Warn(msg string, args ...interface{}) {
	azlog.Warn(msg, args)
}

func Debug(msg string, args ...interface{}) {
	azlog.Debug(msg, args)
}

func Error(msg string, args ...interface{}) {
	azlog.Error(msg, args)
}

func Info(msg string, args ...interface{}) {
	azlog.Info(msg, args)
}

func ExtractOrCreateRequestId(ctx context.Context, headers map[string]string) (string, error) {
	clientRequestId, ok := headers["X-Ms-Client-Request-Id"]
	if !ok {
		if traceID := tracing.TraceIDFromContext(ctx, false); traceID != "" {
			clientRequestId = traceID
			azlog.Info("Client request id inherited from traceID", "clientRequestId", clientRequestId)
		} else {
			uid, err := uuid.NewRandom()
			if err != nil {
				Error("failed to create new client request Id", "err", err)
				return "", err
			}
			clientRequestId = uid.String()
			azlog.Info("Client request id created", "clientRequestId", clientRequestId)
		}
	} else {
		azlog.Info("Client request id extracted from HTTP headers", "clientRequestId", clientRequestId)
	}

	return clientRequestId, nil
}
