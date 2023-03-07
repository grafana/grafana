package oauthimpl

import (
	"log"
	"net/http"
)

func (s *OAuth2ServiceImpl) HandleIntrospectionRequest(rw http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	currentOAuthSessionData := NewPluginAuthSession("")
	ir, err := s.oauthProvider.NewIntrospectionRequest(ctx, req, currentOAuthSessionData)
	if err != nil {
		log.Printf("Error occurred in NewIntrospectionRequest: %+v", err)
		s.oauthProvider.WriteIntrospectionError(ctx, rw, err)
		return
	}

	s.oauthProvider.WriteIntrospectionResponse(ctx, rw, ir)
}
