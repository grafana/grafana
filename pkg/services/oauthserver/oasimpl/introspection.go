package oasimpl

import (
	"log"
	"net/http"
)

// HandleIntrospectionRequest handles the OAuth2 query to determine the active state of an OAuth 2.0 token and
// to determine meta-information about this token
func (s *OAuth2ServiceImpl) HandleIntrospectionRequest(rw http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	currentOAuthSessionData := NewAuthSession()
	ir, err := s.oauthProvider.NewIntrospectionRequest(ctx, req, currentOAuthSessionData)
	if err != nil {
		log.Printf("Error occurred in NewIntrospectionRequest: %+v", err)
		s.oauthProvider.WriteIntrospectionError(ctx, rw, err)
		return
	}

	s.oauthProvider.WriteIntrospectionResponse(ctx, rw, ir)
}
