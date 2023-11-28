package routes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func AccountsHandler(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	region := parameters.Get("region")
	if region == "" {
		return nil, models.NewHttpError("error in AccountsHandler", http.StatusBadRequest, fmt.Errorf("region is required"))
	}

	service, err := newAccountsService(ctx, pluginCtx, reqCtxFactory, region)
	if err != nil {
		return nil, models.NewHttpError("error in AccountsHandler", http.StatusInternalServerError, err)
	}

	accounts, err := service.GetAccountsForCurrentUserOrRole()
	if err != nil {
		msg := "error getting accounts for current user or role"
		switch {
		case errors.Is(err, services.ErrAccessDeniedException):
			return nil, models.NewHttpError(msg, http.StatusForbidden, err)
		default:
			return nil, models.NewHttpError(msg, http.StatusInternalServerError, err)
		}
	}

	accountsResponse, err := json.Marshal(accounts)
	if err != nil {
		return nil, models.NewHttpError("error in AccountsHandler", http.StatusInternalServerError, err)
	}

	return accountsResponse, nil
}

// newAccountService is an account service factory.
//
// Stubbable by tests.
var newAccountsService = func(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.AccountsProvider, error) {
	oamClient, err := reqCtxFactory(ctx, pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewAccountsService(oamClient.OAMAPIProvider), nil
}
