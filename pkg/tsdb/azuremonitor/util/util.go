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

func InstrumentQueryDataRequest(ctx context.Context, req *http.Request, dsInfo types.DatasourceInfo, client *http.Client, logger log.Logger, logMessage string) (*http.Response, error) {
	status := "ok"

	start := time.Now()

	res, err := client.Do(req)
	if err != nil {
		status = "error"
	} else {
		status = res.Status
	}

	elapsed := time.Since(start)

	logParams := []interface{}{
		"url", req.URL.Host,
		"method", req.Method,
		"path", req.URL.Path,
		"cloud", dsInfo.Cloud,
		"authType", dsInfo.JSONData["azureAuthType"],
		"subId", dsInfo.Settings.SubscriptionId,
		"datasourceID", dsInfo.DatasourceID,
		"status", status,
		"duration", elapsed,
	}

	user, ok := GetBackendUserFromContext(ctx)

	if ok {
		logParams = append(logParams, "uname", user.Email)
	}

	traceID := tracing.TraceIDFromContext(ctx, false)
	if traceID != "" {
		logParams = append(logParams, "traceID", traceID)
	}

	logger.Info(logMessage, logParams...)

	return res, err
}
