package social

import (
	"encoding/json"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type SocialGoogle struct {
	*SocialBase
	hostedDomain string
	apiUrl       string
}

func (s *SocialGoogle) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	var data struct {
		Id    string `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}

	response, err := s.httpGet(client, s.apiUrl)
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	err = json.Unmarshal(response.Body, &data)
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	return &BasicUserInfo{
		Id:    data.Id,
		Name:  data.Name,
		Email: data.Email,
		Login: data.Email,
	}, nil
}

func (s *SocialGoogle) AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	if s.features.IsEnabled(featuremgmt.FlagAccessTokenExpirationCheck) {
		opts = append(opts, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
	}
	return s.SocialBase.AuthCodeURL(state, opts...)
}
