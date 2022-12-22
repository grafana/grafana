package util

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func GetBackendUserFromContext(ctx context.Context) (*backend.User, bool) {
	if val := ctx.Value(backend.User{}); val != nil {
		user, ok := val.(*backend.User)
		return user, ok
	}
	return nil, false
}

func LogDataQuery(logger log.Logger, logMessage string, duration time.Duration, dsInfo types.DatasourceInfo, ctx context.Context, req *http.Request, res *http.Response) {
	traceID := tracing.TraceIDFromContext(ctx, false)

	user, ok := GetBackendUserFromContext(ctx)
	userEmail := ""
	if ok {
		userEmail = user.Email
	}
	logger.Info(logMessage,
		"url", req.URL.Host,
		"method", req.Method,
		"path", req.URL.Path,
		"cloud", dsInfo.Cloud,
		"authType", dsInfo.JSONData["azureAuthType"],
		"subId", dsInfo.Settings.SubscriptionId,
		"datasourceID", dsInfo.DatasourceID,
		"status", res.StatusCode,
		"duration", duration,
		"user", userEmail,
		"traceID", traceID)
}
