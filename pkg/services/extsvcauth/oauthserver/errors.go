package oauthserver

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrClientNotFoundMessageID = "oauthserver.client-not-found"
)

var (
	ErrClientRequiredID = errutil.BadRequest(
		"oauthserver.required-client-id",
		errutil.WithPublicMessage("client ID is required")).Errorf("Client ID is required")
	ErrClientRequiredName = errutil.BadRequest(
		"oauthserver.required-client-name",
		errutil.WithPublicMessage("client name is required")).Errorf("Client name is required")
	ErrClientNotFound = errutil.NotFound(
		ErrClientNotFoundMessageID,
		errutil.WithPublicMessage("Requested client has not been found"))
)

func ErrClientNotFoundFn(clientID string) error {
	return ErrClientNotFound.Errorf("client '%s' not found", clientID)
}
