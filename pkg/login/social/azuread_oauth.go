package social

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/models"

	jwt "github.com/dgrijalva/jwt-go"
	"golang.org/x/oauth2"
)

type SocialAzureAD struct {
	*SocialBase
	allowedDomains []string
	hostedDomain   string
	apiUrl         string
	allowSignup    bool
	wellKnwonUrl   string
}

func (s *SocialAzureAD) Type() int {
	return int(models.AZUREAD)
}

func (s *SocialAzureAD) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *SocialAzureAD) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *SocialAzureAD) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	var data struct {
		Id         string `json:"id"`
		Name       string `json:"name"`
		Email      string `json:"email"`
		Upn        string `json:"upn"`
		UniqueName string `json:"unique_name"`
		Roles      string `json:"roles"`
	}

	var jwtToken = NewToken(token, s.wellKnwonUrl)

	parsedToken, err := jwtToken.Parse()
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	if !parsedToken.Valid {
		return nil, fmt.Errorf("Error validating token")
	}

	claims, ok := parsedToken.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("Error getting claims from token")
	}

	email := extractEmail(claims)

	if email == "" {
		return nil, fmt.Errorf("Error getting user info: No email found in access token")
	}

	role := extractRole(claims)

	return &BasicUserInfo{
		Id:    data.Id,
		Name:  data.Name,
		Email: email,
		Login: email,
		Role:  role,
	}, nil
}

func extractEmail(claims jwt.MapClaims) string {
	var email string

	if _, ok := claims["email"]; !ok {
		if u, ok := claims["upn"]; ok {
			email = u.(string)
			return email
		}
		if u, ok := claims["unique_name"]; ok {
			email = u.(string)
			return email
		}
	}

	return claims["email"].(string)
}

func extractRole(claims jwt.MapClaims) string {
	var role string
	if roles, ok := claims["roles"].([]interface{}); ok {
		if len(roles) > 0 {
			switch r := roles[0].(type) {
			case string:
				role = r
			}
		}
	}

	return role
}
