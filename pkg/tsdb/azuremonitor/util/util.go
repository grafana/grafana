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
	logParams := []interface{}{
		"url", req.URL.Host,
		"method", req.Method,
		"path", req.URL.Path,
		"cloud", dsInfo.Cloud,
		"datasourceID", dsInfo.DatasourceID,
		"subId", dsInfo.Settings.SubscriptionId,
	}

	start := time.Now()
	req.URL = nil
	res, err := client.Do(req)
	elapsed := time.Since(start)

	if err != nil {
		logParams = append(logParams, "status", "internal error")
		logParams = append(logParams, "error", err.Error())
	} else {
		logParams = append(logParams, "status", res.StatusCode)
	}

	logParams = append(logParams, "duration", elapsed)

	if dsInfo.Credentials != nil {
		logParams = append(logParams, "authType", dsInfo.Credentials.AzureAuthType())
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
