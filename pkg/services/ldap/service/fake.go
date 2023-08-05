package service

import (
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/ldap/multildap"
	"github.com/grafana/grafana/pkg/services/login"
)

type LDAPFakeService struct {
	ExpectedConfig *ldap.Config
	ExpectedClient multildap.IMultiLDAP
	ExpectedError  error
	ExpectedUser   *login.ExternalUserInfo
	UserCalled     bool
}

func NewLDAPFakeService() *LDAPFakeService {
	return &LDAPFakeService{}
}

func (s *LDAPFakeService) ReloadConfig() error {
	return s.ExpectedError
}

func (s *LDAPFakeService) Config() *ldap.Config {
	return s.ExpectedConfig
}

func (s *LDAPFakeService) Client() multildap.IMultiLDAP {
	return s.ExpectedClient
}

func (s *LDAPFakeService) Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error) {
	return s.ExpectedUser, s.ExpectedError
}

func (s *LDAPFakeService) User(username string) (*login.ExternalUserInfo, error) {
	s.UserCalled = true
	return s.ExpectedUser, s.ExpectedError
}
