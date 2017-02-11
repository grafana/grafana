package social

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"golang.org/x/oauth2"
)

type SocialAzure struct {
	*oauth2.Config
	allowedDomains  []string
	hostedDomain    string
	apiUrl          string
	allowSignup     bool
	graphApiVersion string
}

func (s *SocialAzure) Type() int {
	return int(models.AZURE)
}

func (s *SocialAzure) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *SocialAzure) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *SocialAzure) UserInfo(client *http.Client) (*BasicUserInfo, error) {
	var data struct {
		Name    string `json:"displayName"`
		Email   string `json:"mail"`
		Login   string `json:"userPrincipalName"`
		Company string `json:"companyName"`
	}

	var err error
	r, err := client.Get(s.apiUrl + "/me?api-version=" + s.graphApiVersion)
	if err != nil {
		return nil, err
	}

	defer r.Body.Close()

	if err = json.NewDecoder(r.Body).Decode(&data); err != nil {
		return nil, err
	}

	return &BasicUserInfo{
		Name:    data.Name,
		Email:   data.Email,
		Login:   data.Login,
		Company: data.Company,
	}, nil
}
