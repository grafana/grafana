package social

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/models"

	"golang.org/x/oauth2"
)

type SocialGrafanaNet struct {
	*oauth2.Config
	url                  string
	allowedOrganizations []string
	allowSignup          bool
}

func (s *SocialGrafanaNet) Type() int {
	return int(models.GRAFANANET)
}

func (s *SocialGrafanaNet) IsEmailAllowed(email string) bool {
	return true
}

func (s *SocialGrafanaNet) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *SocialGrafanaNet) IsOrganizationMember(client *http.Client) bool {
	if len(s.allowedOrganizations) == 0 {
		return true
	}

	organizations, err := s.FetchOrganizations(client)
	if err != nil {
		return false
	}

	for _, allowedOrganization := range s.allowedOrganizations {
		for _, organization := range organizations {
			if organization == allowedOrganization {
				return true
			}
		}
	}

	return false
}

func (s *SocialGrafanaNet) FetchOrganizations(client *http.Client) ([]string, error) {
	type Record struct {
		Login string `json:"login"`
	}

	url := fmt.Sprintf(s.url + "/api/oauth2/user/orgs")
	r, err := client.Get(url)
	if err != nil {
		return nil, err
	}

	defer r.Body.Close()

	var records []Record

	if err = json.NewDecoder(r.Body).Decode(&records); err != nil {
		return nil, err
	}

	var logins = make([]string, len(records))
	for i, record := range records {
		logins[i] = record.Login
	}

	return logins, nil
}

func (s *SocialGrafanaNet) UserInfo(token *oauth2.Token) (*BasicUserInfo, error) {
	var data struct {
		Id    int    `json:"id"`
		Name  string `json:"login"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}

	var err error
	client := s.Client(oauth2.NoContext, token)
	r, err := client.Get(s.url + "/api/oauth2/user")
	if err != nil {
		return nil, err
	}

	defer r.Body.Close()

	if err = json.NewDecoder(r.Body).Decode(&data); err != nil {
		return nil, err
	}

	userInfo := &BasicUserInfo{
		Identity: strconv.Itoa(data.Id),
		Name:     data.Name,
		Email:    data.Email,
		Role:     data.Role,
	}

	if !s.IsOrganizationMember(client) {
		return nil, ErrMissingOrganizationMembership
	}

	return userInfo, nil
}
