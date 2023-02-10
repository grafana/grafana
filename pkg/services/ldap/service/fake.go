package service

import (
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/ldap/multildap"
)

type LDAPFakeService struct {
	ExpectedConfig *ldap.Config
	ExpectedClient multildap.IMultiLDAP
	ExpectedError  error
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
