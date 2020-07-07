package multildap

import (
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
)

// logger to log
var logger = log.New("ldap")

// GetConfig gets LDAP config
var GetConfig = ldap.GetConfig

// IsEnabled checks if LDAP is enabled
var IsEnabled = ldap.IsEnabled

// newLDAP return instance of the single LDAP server
var newLDAP = ldap.New

// ErrInvalidCredentials is returned if username and password do not match
var ErrInvalidCredentials = ldap.ErrInvalidCredentials

// ErrCouldNotFindUser is returned when username hasn't been found (not username+password)
var ErrCouldNotFindUser = ldap.ErrCouldNotFindUser

// ErrNoLDAPServers is returned when there is no LDAP servers specified
var ErrNoLDAPServers = errors.New("No LDAP servers are configured")

// ErrDidNotFindUser if request for user is unsuccessful
var ErrDidNotFindUser = errors.New("Did not find a user")

// ServerStatus holds the LDAP server status
type ServerStatus struct {
	Host      string
	Port      int
	Available bool
	Error     error
}

// IMultiLDAP is interface for MultiLDAP
type IMultiLDAP interface {
	Ping() ([]*ServerStatus, error)
	Login(query *models.LoginUserQuery) (
		*models.ExternalUserInfo, error,
	)

	Users(logins []string) (
		[]*models.ExternalUserInfo, error,
	)

	User(login string) (
		*models.ExternalUserInfo, ldap.ServerConfig, error,
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

// Ping dials each of the LDAP servers and returns their status. If the server is unavailable, it also returns the error.
func (multiples *MultiLDAP) Ping() ([]*ServerStatus, error) {
	if len(multiples.configs) == 0 {
		return nil, ErrNoLDAPServers
	}

	serverStatuses := []*ServerStatus{}
	for _, config := range multiples.configs {
		status := &ServerStatus{}

		status.Host = config.Host
		status.Port = config.Port

		server := newLDAP(config)
		err := server.Dial()

		if err == nil {
			status.Available = true
			serverStatuses = append(serverStatuses, status)
			server.Close()
		} else {
			status.Available = false
			status.Error = err
			serverStatuses = append(serverStatuses, status)
		}
	}

	return serverStatuses, nil
}

// Login tries to log in the user in multiples LDAP
func (multiples *MultiLDAP) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {
	if len(multiples.configs) == 0 {
		return nil, ErrNoLDAPServers
	}

	for index, config := range multiples.configs {
		server := newLDAP(config)

		if err := server.Dial(); err != nil {
			logDialFailure(err, config)

			// Only return an error if it is the last server so we can try next server
			if index == len(multiples.configs)-1 {
				return nil, err
			}
			continue
		}

		defer server.Close()

		user, err := server.Login(query)
		// FIXME
		if user != nil {
			return user, nil
		}
		if err != nil {
			if isSilentError(err) {
				logger.Debug(
					"unable to login with LDAP - skipping server",
					"host", config.Host,
					"port", config.Port,
					"error", err,
				)
				continue
			}

			return nil, err
		}
	}

	// Return invalid credentials if we couldn't find the user anywhere
	return nil, ErrInvalidCredentials
}

// User attempts to find an user by login/username by searching into all of the configured LDAP servers. Then, if the user is found it returns the user alongisde the server it was found.
func (multiples *MultiLDAP) User(login string) (
	*models.ExternalUserInfo,
	ldap.ServerConfig,
	error,
) {
	if len(multiples.configs) == 0 {
		return nil, ldap.ServerConfig{}, ErrNoLDAPServers
	}

	search := []string{login}
	for index, config := range multiples.configs {
		server := newLDAP(config)

		if err := server.Dial(); err != nil {
			logDialFailure(err, config)

			// Only return an error if it is the last server so we can try next server
			if index == len(multiples.configs)-1 {
				return nil, *config, err
			}
			continue
		}

		defer server.Close()

		if err := server.Bind(); err != nil {
			return nil, *config, err
		}

		users, err := server.Users(search)
		if err != nil {
			return nil, *config, err
		}

		if len(users) != 0 {
			return users[0], *config, nil
		}
	}

	return nil, ldap.ServerConfig{}, ErrDidNotFindUser
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

	for index, config := range multiples.configs {
		server := newLDAP(config)

		if err := server.Dial(); err != nil {
			logDialFailure(err, config)

			// Only return an error if it is the last server so we can try next server
			if index == len(multiples.configs)-1 {
				return nil, err
			}
			continue
		}

		defer server.Close()

		if err := server.Bind(); err != nil {
			return nil, err
		}

		users, err := server.Users(logins)
		if err != nil {
			return nil, err
		}
		result = append(result, users...)
	}

	return result, nil
}

// isSilentError evaluates an error and tells whenever we should fail the LDAP request
// immediately or if we should continue into other LDAP servers
func isSilentError(err error) bool {
	continueErrs := []error{ErrInvalidCredentials, ErrCouldNotFindUser}

	for _, cerr := range continueErrs {
		if err == cerr {
			return true
		}
	}

	return false
}

func logDialFailure(err error, config *ldap.ServerConfig) {
	logger.Debug(
		"unable to dial LDAP server",
		"host", config.Host,
		"port", config.Port,
		"error", err,
	)
}
