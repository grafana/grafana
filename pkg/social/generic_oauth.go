package social

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"

	"golang.org/x/oauth2"
)

type GenericOAuth struct {
	*oauth2.Config
	allowedDomains       []string
	allowedOrganizations []string
	apiUrl               string
	allowSignup          bool
	teamIds              []int
}

func (s *GenericOAuth) Type() int {
	return int(models.GENERIC)
}

func (s *GenericOAuth) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *GenericOAuth) UserInfo(token *oauth2.Token) (*BasicUserInfo, error) {
	var data struct {
		Id    string `json:"id"`
		Name  string `json:"username"`
	}

	var err error
	client := s.Client(oauth2.NoContext, token)
	r, err := client.Get(s.apiUrl)
	if err != nil {
		return nil, err
	}

	defer r.Body.Close()

	if err = json.NewDecoder(r.Body).Decode(&data); err != nil {
		return nil, err
	}

	userInfo := &BasicUserInfo{
		Identity: data.Id,
		Name:     data.Name,
	}

	return userInfo, nil
}
