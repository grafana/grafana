package multildap

import (
	"errors"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
)

// GetConfig gets LDAP config
var GetConfig = ldap.GetConfig

// IsEnabled checks if LDAP is enabled
var IsEnabled = ldap.IsEnabled

// newLDAP return instance of the single LDAP server
var newLDAP = ldap.New

// ErrInvalidCredentials is returned if username and password do not match
var ErrInvalidCredentials = ldap.ErrInvalidCredentials

// ErrNoLDAPServers is returned when there is no LDAP servers specified
var ErrNoLDAPServers = errors.New("No LDAP servers are configured")

// ErrDidNotFindUser if request for user is unsuccessful
var ErrDidNotFindUser = errors.New("Did not find a user")

// IMultiLDAP is interface for MultiLDAP
type IMultiLDAP interface {
	Login(query *models.LoginUserQuery) (
		*models.ExternalUserInfo, error,
	)

	Users(logins []string) (
		[]*models.ExternalUserInfo, error,
	)

	User(login string) (
		*models.ExternalUserInfo, error,
	)
}

// MultiLDAP is basic struct of LDAP authorization
type MultiLDAP struct {
	configs []*ldap.ServerConfig
}

// New creates the new LDAP auth
func New(configs []*ldap.ServerConfig) IMultiLDAP {
	return &MultiLDAP{
		configs: configs,
	}
}

// Login tries to log in the user in multiples LDAP
func (multiples *MultiLDAP) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {

	if len(multiples.configs) == 0 {
		return nil, ErrNoLDAPServers
	}

	for _, config := range multiples.configs {
		server := newLDAP(config)

		if err := server.Dial(); err != nil {
			return nil, err
		}

		defer server.Close()

		user, err := server.Login(query)
		if user != nil {
			return user, nil
		}

		// Continue if we couldn't find the user
		if err == ErrInvalidCredentials {
			continue
		}

		if err != nil {
			return nil, err
		}
	}

	// Return invalid credentials if we couldn't find the user anywhere
	return nil, ErrInvalidCredentials
}

// User gets a user by login
func (multiples *MultiLDAP) User(login string) (
	*models.ExternalUserInfo,
	error,
) {

	if len(multiples.configs) == 0 {
		return nil, ErrNoLDAPServers
	}

	search := []string{login}
	for _, config := range multiples.configs {
		server := newLDAP(config)

		if err := server.Dial(); err != nil {
			return nil, err
		}

		defer server.Close()

		users, err := server.Users(search)
		if err != nil {
			return nil, err
		}

		if len(users) != 0 {
			return users[0], nil
		}
	}

	return nil, ErrDidNotFindUser
}

// Users gets users from multiple LDAP servers
func (multiples *MultiLDAP) Users(logins []string) (
	[]*models.ExternalUserInfo,
	error,
) {
	var result []*models.ExternalUserInfo

	if len(multiples.configs) == 0 {
		return nil, ErrNoLDAPServers
	}

	for _, config := range multiples.configs {
		server := newLDAP(config)

		if err := server.Dial(); err != nil {
			return nil, err
		}

		defer server.Close()

		users, err := server.Users(logins)
		if err != nil {
			return nil, err
		}
		result = append(result, users...)
	}

	return result, nil
}
