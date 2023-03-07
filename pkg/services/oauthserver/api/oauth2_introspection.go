package api

import (
	"log"
	"net/http"
)

func (a *api) introspectionEndpoint(rw http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	currentOAuthSessionData := NewPluginAuthSession("")
	ir, err := a.oauthProvider.NewIntrospectionRequest(ctx, req, currentOAuthSessionData)
	if err != nil {
		log.Printf("Error occurred in NewIntrospectionRequest: %+v", err)
		a.oauthProvider.WriteIntrospectionError(ctx, rw, err)
		return
	}

	a.oauthProvider.WriteIntrospectionResponse(ctx, rw, ir)
}
