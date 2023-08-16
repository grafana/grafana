package oauthserver

import (
	"fmt"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrClientNotFoundMessageID = "oauthserver.client-not-found"
)

var (
	ErrClientRequiredID = errutil.NewBase(errutil.StatusBadRequest,
		"oauthserver.required-client-id",
		errutil.WithPublicMessage("client ID is required")).Errorf("Client ID is required")
	ErrClientRequiredName = errutil.NewBase(errutil.StatusBadRequest,
		"oauthserver.required-client-name",
		errutil.WithPublicMessage("client name is required")).Errorf("Client name is required")
)

func ErrClientNotFound(clientID string) error {
	return errutil.NewBase(errutil.StatusNotFound,
		ErrClientNotFoundMessageID,
		errutil.WithPublicMessage(fmt.Sprintf("Client '%s' not found", clientID))).
		Errorf("client '%s' not found", clientID)
}
