package multildap

import (
	"errors"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

// GetConfig gets LDAP config
var GetConfig = ldap.GetConfig

// newLDAP return instance of the single LDAP server
var newLDAP = ldap.New

var (
	// ErrInvalidCredentials is returned if username and password do not match
	ErrInvalidCredentials = ldap.ErrInvalidCredentials
	// ErrCouldNotFindUser is returned when username hasn't been found (not username+password)
	ErrCouldNotFindUser = ldap.ErrCouldNotFindUser
	// ErrNoLDAPServers is returned when there is no LDAP servers specified
	ErrNoLDAPServers = errors.New("no LDAP servers are configured")
	// ErrDidNotFindUser if request for user is unsuccessful
	ErrDidNotFindUser = errors.New("did not find a user")
)

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
	Login(query *login.LoginUserQuery) (
		*login.ExternalUserInfo, error,
	)

	Users(logins []string) (
		[]*login.ExternalUserInfo, error,
	)

	User(login string) (
		*login.ExternalUserInfo, ldap.ServerConfig, error,
	)
}

// MultiLDAP is basic struct of LDAP authorization
type MultiLDAP struct {
	configs []*ldap.ServerConfig
	cfg     *setting.Cfg
	log     log.Logger
}

// New creates the new LDAP auth
func New(configs []*ldap.ServerConfig, cfg *setting.Cfg) IMultiLDAP {
	return &MultiLDAP{
		configs: configs,
		cfg:     cfg,
		log:     log.New("ldap"),
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

		server := newLDAP(config, multiples.cfg)
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
func (multiples *MultiLDAP) Login(query *login.LoginUserQuery) (
	*login.ExternalUserInfo, error,
) {
	if len(multiples.configs) == 0 {
		return nil, ErrNoLDAPServers
	}

	ldapSilentErrors := []error{}

	for index, config := range multiples.configs {
		server := newLDAP(config, multiples.cfg)

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
		if err != nil {
			if isSilentError(err) {
				ldapSilentErrors = append(ldapSilentErrors, err)
				multiples.log.Debug(
					"unable to login with LDAP - skipping server",
					"host", config.Host,
					"port", config.Port,
					"error", err,
				)
				continue
			}

			return nil, err
		}

		if user != nil {
			return user, nil
		}
	}

	// Return ErrInvalidCredentials in case any of the errors was ErrInvalidCredentials (means that the authentication has failed at least once)
	for _, ldapErr := range ldapSilentErrors {
		if errors.Is(ldapErr, ErrInvalidCredentials) {
			return nil, ErrInvalidCredentials
		}
	}

	// Return ErrCouldNotFindUser if all of the configured LDAP servers returned with ErrCouldNotFindUser
	return nil, ErrCouldNotFindUser
}

// User attempts to find an user by login/username by searching into all of the configured LDAP servers. Then, if the user is found it returns the user alongisde the server it was found.
func (multiples *MultiLDAP) User(login string) (
	*login.ExternalUserInfo,
	ldap.ServerConfig,
	error,
) {
	if len(multiples.configs) == 0 {
		return nil, ldap.ServerConfig{}, ErrNoLDAPServers
	}

	search := []string{login}
	for index, config := range multiples.configs {
		server := newLDAP(config, multiples.cfg)

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
	[]*login.ExternalUserInfo,
	error,
) {
	var result []*login.ExternalUserInfo

	if len(multiples.configs) == 0 {
		return nil, ErrNoLDAPServers
	}

	for index, config := range multiples.configs {
		server := newLDAP(config, multiples.cfg)

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
		if errors.Is(err, cerr) {
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
