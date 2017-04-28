package social

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"

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

func (s *GenericOAuth) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *GenericOAuth) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *GenericOAuth) IsTeamMember(client *http.Client) bool {
	if len(s.teamIds) == 0 {
		return true
	}

	teamMemberships, err := s.FetchTeamMemberships(client)
	if err != nil {
		return false
	}

	for _, teamId := range s.teamIds {
		for _, membershipId := range teamMemberships {
			if teamId == membershipId {
				return true
			}
		}
	}

	return false
}

func (s *GenericOAuth) IsOrganizationMember(client *http.Client) bool {
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

func (s *GenericOAuth) FetchPrivateEmail(client *http.Client) (string, error) {
	type Record struct {
		Email       string `json:"email"`
		Primary     bool   `json:"primary"`
		IsPrimary   bool   `json:"is_primary"`
		Verified    bool   `json:"verified"`
		IsConfirmed bool   `json:"is_confirmed"`
	}

	emailsUrl := fmt.Sprintf(s.apiUrl + "/emails")
	r, err := client.Get(emailsUrl)
	if err != nil {
		return "", err
	}

	defer r.Body.Close()

	var records []Record

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return "", err
	}

	err = json.Unmarshal(body, records)
	if err != nil {
		var data struct {
			Values []Record `json:"values"`
		}

		err = json.Unmarshal(body, &data)
		if err != nil {
			return "", err
		}

		records = data.Values
	}

	var email = ""
	for _, record := range records {
		if record.Primary || record.IsPrimary {
			email = record.Email
			break
		}
	}

	return email, nil
}

func (s *GenericOAuth) FetchTeamMemberships(client *http.Client) ([]int, error) {
	type Record struct {
		Id int `json:"id"`
	}

	membershipUrl := fmt.Sprintf(s.apiUrl + "/teams")
	r, err := client.Get(membershipUrl)
	if err != nil {
		return nil, err
	}

	defer r.Body.Close()

	var records []Record

	if err = json.NewDecoder(r.Body).Decode(&records); err != nil {
		return nil, err
	}

	var ids = make([]int, len(records))
	for i, record := range records {
		ids[i] = record.Id
	}

	return ids, nil
}

func (s *GenericOAuth) FetchOrganizations(client *http.Client) ([]string, error) {
	type Record struct {
		Login string `json:"login"`
	}

	url := fmt.Sprintf(s.apiUrl + "/orgs")
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

func (s *GenericOAuth) UserInfo(client *http.Client) (*BasicUserInfo, error) {
	var data struct {
		Name        string              `json:"name"`
		DisplayName string              `json:"display_name"`
		Login       string              `json:"login"`
		Username    string              `json:"username"`
		Email       string              `json:"email"`
		Attributes  map[string][]string `json:"attributes"`
	}

	var err error
	r, err := client.Get(s.apiUrl)
	if err != nil {
		return nil, err
	}

	defer r.Body.Close()

	if err = json.NewDecoder(r.Body).Decode(&data); err != nil {
		return nil, err
	}

	userInfo := &BasicUserInfo{
		Name:  data.Name,
		Login: data.Login,
		Email: data.Email,
	}

	if userInfo.Email == "" && data.Attributes["email:primary"] != nil {
		userInfo.Email = data.Attributes["email:primary"][0]
	}

	if userInfo.Email == "" {
		userInfo.Email, err = s.FetchPrivateEmail(client)
		if err != nil {
			return nil, err
		}
	}

	if userInfo.Name == "" && data.DisplayName != "" {
		userInfo.Name = data.DisplayName
	}

	if userInfo.Login == "" && data.Username != "" {
		userInfo.Login = data.Username
	}

	if userInfo.Login == "" {
		userInfo.Login = data.Email
	}

	if !s.IsTeamMember(client) {
		return nil, errors.New("User not a member of one of the required teams")
	}

	if !s.IsOrganizationMember(client) {
		return nil, errors.New("User not a member of one of the required organizations")
	}

	return userInfo, nil
}
