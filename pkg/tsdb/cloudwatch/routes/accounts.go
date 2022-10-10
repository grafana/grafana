package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func AccountsHandler(rw http.ResponseWriter, req *http.Request, clientFactory models.ClientsFactoryFunc, pluginCtx backend.PluginContext) {
	if req.Method != "GET" {
		respondWithError(rw, http.StatusMethodNotAllowed, "Invalid method", nil)
		return
	}

	region := req.URL.Query().Get("region")
	if region == "" {
		respondWithError(rw, http.StatusBadRequest, "region missing", nil)
		return
	}

	service, err := newAccountsService(pluginCtx, clientFactory, region)
	if err != nil {
		respondWithError(rw, http.StatusInternalServerError, "error in AccountsHandler", err)
		return
	}

	accounts, err := service.GetAccountsForCurrentUserOrRole()
	if err != nil {
		msg := "error getting accounts for current user or role"
		switch {
		case errors.Is(err, services.ErrAccessDeniedException):
			respondWithError(rw, http.StatusForbidden, msg, err)
		default:
			respondWithError(rw, http.StatusInternalServerError, msg, err)
		}
		return
	}

	accountsResponse, err := json.Marshal(accounts)
	if err != nil {
		respondWithError(rw, http.StatusInternalServerError, "error in AccountsHandler", err)
	}

	rw.Header().Set("Content-Type", "application/json")
	_, err = rw.Write(accountsResponse)
	if err != nil {
		respondWithError(rw, http.StatusInternalServerError, "error writing response in AccountsHandler", err)
	}
}

// newAccountService is an account service factory.
//
// Stubbable by tests.
var newAccountsService = func(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, region string) (models.AccountsProvider, error) {
	oamClient, err := clientFactory(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewAccountsService(oamClient), nil
}
