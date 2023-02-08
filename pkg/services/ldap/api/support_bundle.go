package api

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/BurntSushi/toml"

	"github.com/grafana/grafana/pkg/services/supportbundles"
)

func (s *Service) supportBundleCollector(context.Context) (*supportbundles.SupportItem, error) {
	bWriter := bytes.NewBuffer(nil)

	bWriter.WriteString("# LDAP information\n\n")

	bWriter.WriteString("## LDAP configuration\n\n")

	ldapConfig, err := getLDAPConfig(s.cfg)
	bWriter.WriteString("```toml\n")
	errM := toml.NewEncoder(bWriter).Encode(ldapConfig)
	if errM != nil {
		bWriter.WriteString(
			fmt.Sprintf("Unable to encode LDAP configuration  \n Err: %s", err))
	}
	bWriter.WriteString("\n```\n\n")

	if ldapConfig != nil {
		bWriter.WriteString("## LDAP Status\n\n")

		ldapClient := newLDAP(ldapConfig.Servers)

		ldapStatus, err := ldapClient.Ping()
		if err != nil {
			bWriter.WriteString(
				fmt.Sprintf("Unable to ping server\n Err: %s", err))
		}

		for _, server := range ldapStatus {
			bWriter.WriteString(fmt.Sprintf("Host: %s  \n", server.Host))
			bWriter.WriteString(fmt.Sprintf("Port: %d  \n", server.Port))
			bWriter.WriteString(fmt.Sprintf("Available: %v  \n", server.Available))
			if server.Error != nil {
				bWriter.WriteString(fmt.Sprintf("Error: %s  \n", server.Error))
			}
		}

		bWriter.WriteString("## LDAP Common Configuration issues\n\n")
		bWriter.WriteString("**Mismatched search attributes**\n\n")
		issue := false
		for _, server := range ldapConfig.Servers {
			if !strings.Contains(server.SearchFilter, server.Attr.Username) {
				bWriter.WriteString(fmt.Sprintf(
					"Search filter does not contain username attribute  \n"+
						"Server: %s  \n"+
						"Search filter: %s  \n"+
						"Username attribute: %s  \n",
					server.Host, server.SearchFilter, server.Attr.Username))
				issue = true
			}
		}
		if !issue {
			bWriter.WriteString("No issues found  \n")
		}
	}

	return &supportbundles.SupportItem{
		Filename:  "ldap.md",
		FileBytes: bWriter.Bytes(),
	}, nil
}
