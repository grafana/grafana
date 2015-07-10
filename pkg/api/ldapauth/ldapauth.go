package ldapauth

import (
	"errors"
	"fmt"
	"net/url"

	"github.com/go-ldap/ldap"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrInvalidCredentials = errors.New("Invalid Username or Password")
)

func Login(username, password string) error {
	url, err := url.Parse(setting.LdapHosts[0])
	if err != nil {
		return err
	}

	log.Info("Host: %v", url.Host)
	conn, err := ldap.Dial("tcp", url.Host)
	if err != nil {
		return err
	}

	defer conn.Close()

	bindFormat := "cn=%s,dc=grafana,dc=org"

	nx := fmt.Sprintf(bindFormat, username)
	err = conn.Bind(nx, password)

	if err != nil {
		if ldapErr, ok := err.(*ldap.Error); ok {
			if ldapErr.ResultCode == 49 {
				return ErrInvalidCredentials
			}
		}
		return err
	}
	return nil

	// search := ldap.NewSearchRequest(url.Path,
	// 	ldap.ScopeWholeSubtree, ldap.NeverDerefAliases, 0, 0, false,
	// 	fmt.Sprintf(ls.Filter, name),
	// 	[]string{ls.AttributeUsername, ls.AttributeName, ls.AttributeSurname, ls.AttributeMail},
	// 	nil)
	// sr, err := l.Search(search)
	// if err != nil {
	// 	log.Debug("LDAP Authen OK but not in filter %s", name)
	// 	return "", "", "", "", false
	// }
}
