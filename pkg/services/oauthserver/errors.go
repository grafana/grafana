package oauthserver

import (
	"fmt"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrClientRequiredID = errutil.NewBase(errutil.StatusBadRequest,
		"oauthserver.required-client-id",
		errutil.WithPublicMessage("client ID is required")).Errorf("Client ID is required")
)

func ErrClientNotFound(clientID string) error {
	return errutil.NewBase(errutil.StatusNotFound,
		"oauthserver.client-not-found",
		errutil.WithPublicMessage(fmt.Sprintf("Client '%s' not found", clientID))).
		Errorf("client '%s' not found", clientID)
}
