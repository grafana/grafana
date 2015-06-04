package auth

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

var (
	ErrInvalidCredentials = errors.New("Invalid Username or Password")
)

type LoginSettings struct {
	LdapEnabled bool
}

type LdapFilterToOrg struct {
	Filter  string
	OrgId   int
	OrgRole string
}

type LdapSettings struct {
	Enabled      bool
	Hosts        []string
	UseSSL       bool
	BindDN       string
	AttrUsername string
	AttrName     string
	AttrSurname  string
	AttrMail     string
	Filters      []LdapFilterToOrg
}

type AuthSource interface {
	AuthenticateUser(username, password string) (*m.User, error)
}

type GetAuthSourcesQuery struct {
	Sources []AuthSource
}

func init() {
	bus.AddHandler("auth", GetAuthSources)
}

func GetAuthSources(query *GetAuthSourcesQuery) error {
	query.Sources = []AuthSource{&GrafanaDBAuthSource{}}
	return nil
}

type GrafanaDBAuthSource struct {
}

func (s *GrafanaDBAuthSource) AuthenticateUser(username, password string) (*m.User, error) {
	userQuery := m.GetUserByLoginQuery{LoginOrEmail: username}
	err := bus.Dispatch(&userQuery)

	if err != nil {
		return nil, ErrInvalidCredentials
	}

	user := userQuery.Result

	passwordHashed := util.EncodePassword(password, user.Salt)
	if passwordHashed != user.Password {
		return nil, ErrInvalidCredentials
	}

	return user, nil
}
