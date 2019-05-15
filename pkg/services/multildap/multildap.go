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

// ErrInvalidCredentials is returned if username and password do not match
var ErrInvalidCredentials = ldap.ErrInvalidCredentials

// ErrNoLDAPServers is returned when there is no LDAP servers specified
var ErrNoLDAPServers = errors.New("No LDAP servers are configured")

// IMultiLDAP is interface for MultiLDAP
type IMultiLDAP interface {
	Login(query *models.LoginUserQuery) (
		*models.ExternalUserInfo, error,
	)

	Users(logins []string) (
		[]*models.ExternalUserInfo, error,
	)

	Add(dn string, values map[string][]string) error
	Remove(dn string) error
}

// MultiLDAP is basic struct of LDAP authorization
type MultiLDAP struct {
	configs []*ldap.ServerConfig
}

// New creates the new LDAP auth
func New(LDAPs []*ldap.ServerConfig) IMultiLDAP {
	return &MultiLDAP{
		configs: LDAPs,
	}
}

// Add adds user to the *first* defined LDAP
func (multiples *MultiLDAP) Add(
	dn string,
	values map[string][]string,
) error {
	if len(multiples.configs) == 0 {
		return ErrNoLDAPServers
	}

	config := multiples.configs[0]
	ldap := ldap.New(config)

	if err := ldap.Dial(); err != nil {
		return err
	}

	defer ldap.Close()

	err := ldap.Add(dn, values)
	if err != nil {
		return err
	}

	return nil
}

// Remove removes user from the *first* defined LDAP
func (multiples *MultiLDAP) Remove(dn string) error {
	if len(multiples.configs) == 0 {
		return ErrNoLDAPServers
	}

	config := multiples.configs[0]
	ldap := ldap.New(config)

	if err := ldap.Dial(); err != nil {
		return err
	}

	defer ldap.Close()

	err := ldap.Remove(dn)
	if err != nil {
		return err
	}

	return nil
}

// Login tries to log in the user in multiples LDAP
func (multiples *MultiLDAP) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {
	if len(multiples.configs) == 0 {
		return nil, ErrNoLDAPServers
	}

	for _, config := range multiples.configs {
		server := ldap.New(config)

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

		return user, nil
	}

	// Return invalid credentials if we couldn't find the user anywhere
	return nil, ErrInvalidCredentials
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
		server := ldap.New(config)

		if err := server.Dial(); err != nil {
			return nil, err
		}

		defer server.Close()

		users, err := server.Users()
		if err != nil {
			return nil, err
		}
		result = append(result, users...)
	}

	return result, nil
}
