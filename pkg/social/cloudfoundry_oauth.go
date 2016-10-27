package social

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/models"

	"errors"
	"fmt"
	"golang.org/x/oauth2"
)

type (
	CFOAuth struct {
		*oauth2.Config
		uaaUrl      string
		apiUrl      string
		allowSignUp bool
		allowedOrgs map[string][]string
	}

	CFUserInfo struct {
		UserID   string `json:"user_id"`
		Name     string `json:"name"`
		Login    string `json:"login"`
		Username string `json:"user_name"`
		Email    string `json:"email"`
	}

	CFResource struct {
		NextURL   string `json:"next_url"`
		Resources []struct {
			Metadata struct {
				GUID string `json:"guid"`
			} `json:"metadata"`

			Entity struct {
				Name    string `json:"name"`
				OrgGUID string `json:"organization_guid"`
			} `json:"entity"`
		} `json:"resources"`
	}
)

var ErrCFNotAuthorized = errors.New("User is not a member one of the provided orgs and spaces")

func (s *CFOAuth) Type() int {
	return int(models.CLOUDFOUNDRY)
}

func (s *CFOAuth) IsEmailAllowed(email string) bool {
	return true
}

func (s *CFOAuth) IsSignupAllowed() bool {
	return s.allowSignUp
}

func (s *CFOAuth) UserInfo(client *http.Client) (*BasicUserInfo, error) {
	var data CFUserInfo
	if err := s.request(client, s.uaaUrl+"/userinfo", &data); err != nil {
		return nil, err
	}

	userOrgs, err := s.userOrgs(client, data.UserID)
	if err != nil {
		return nil, err
	}

	if len(s.allowedOrgs) > 0 && !s.hasAuthorizedOrg(userOrgs) {
		return nil, ErrCFNotAuthorized
	}

	return &BasicUserInfo{
		Name:  data.Name,
		Login: data.Login,
		Email: data.Email,
	}, nil
}

func (s *CFOAuth) hasAuthorizedOrg(userOrgs map[string][]string) bool {
	for org, spaces := range s.allowedOrgs {
		if _, ok := userOrgs[org]; !ok {
			continue
		}

		if len(spaces) == 0 {
			return true
		}

		if len(userOrgs[org]) > 0 {
			for _, space := range spaces {
				for _, userSpace := range userOrgs[org] {
					if space == userSpace {
						return true
					}
				}
			}
		}
	}

	return false
}

func (s *CFOAuth) userOrgs(client *http.Client, userID string) (map[string][]string, error) {
	userOrgs := map[string][]string{}

	orgsURL := fmt.Sprintf("%s/v2/users/%s/organizations?q=status:active", s.apiUrl, userID)
	orgs, err := s.resource(client, orgsURL, nil)
	if err != nil {
		return nil, err
	}

	if len(orgs.Resources) == 0 {
		return userOrgs, nil
	}

	spacesURL := fmt.Sprintf("%s/v2/users/%s/spaces", s.apiUrl, userID)
	spaces, err := s.resource(client, spacesURL, nil)
	if err != nil {
		return nil, err
	}

	for _, org := range orgs.Resources {
		if _, ok := userOrgs[org.Entity.Name]; !ok {
			userOrgs[org.Entity.Name] = make([]string, 0)
		}

		for _, space := range spaces.Resources {
			if space.Entity.OrgGUID == org.Metadata.GUID {
				userOrgs[org.Entity.Name] = append(userOrgs[org.Entity.Name], space.Entity.Name)
			}
		}
	}

	return userOrgs, nil
}

func (s *CFOAuth) request(client *http.Client, url string, v interface{}) error {
	req, err := client.Get(url)
	if err != nil {
		return err
	}

	defer req.Body.Close()

	if err = json.NewDecoder(req.Body).Decode(v); err != nil {
		return err
	}

	return nil
}

func (s *CFOAuth) resource(client *http.Client, url string, prev *CFResource) (*CFResource, error) {
	next := CFResource{}

	if err := s.request(client, url, &next); err != nil {
		return nil, err
	}

	if prev != nil {
		next.Resources = append(prev.Resources, next.Resources...)
	}

	if next.NextURL != "" {
		return s.resource(client, next.NextURL, &next)
	}

	return &next, nil
}
