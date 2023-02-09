package api

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/BurntSushi/toml"

	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/setting"
)

func (s *Service) supportBundleCollector(context.Context) (*supportbundles.SupportItem, error) {
	bWriter := bytes.NewBuffer(nil)
	bWriter.WriteString("# LDAP information\n\n")

	ldapConfig, err := getLDAPConfig(s.cfg)

	if ldapConfig != nil {
		bWriter.WriteString("## LDAP Status\n")

		ldapClient := newLDAP(ldapConfig.Servers)

		ldapStatus, err := ldapClient.Ping()
		if err != nil {
			bWriter.WriteString(
				fmt.Sprintf("Unable to ping server\n Err: %s", err))
		}

		for _, server := range ldapStatus {
			bWriter.WriteString(fmt.Sprintf("\nHost: %s  \n", server.Host))
			bWriter.WriteString(fmt.Sprintf("Port: %d  \n", server.Port))
			bWriter.WriteString(fmt.Sprintf("Available: %v  \n", server.Available))
			if server.Error != nil {
				bWriter.WriteString(fmt.Sprintf("Error: %s\n", server.Error))
			}
		}

		bWriter.WriteString("\n## LDAP Common Configuration issues\n\n")
		bWriter.WriteString("- Checked for **Mismatched search attributes**\n\n")
		issue := false
		for _, server := range ldapConfig.Servers {
			server.BindPassword = "********" // censor password on config dump
			server.ClientKey = "********"    // censor client key on config dump

			if !strings.Contains(server.SearchFilter, server.Attr.Username) {
				bWriter.WriteString(fmt.Sprintf(
					"Search filter does not match username attribute  \n"+
						"Server: %s  \n"+
						"Search filter: %s  \n"+
						"Username attribute: %s  \n",
					server.Host, server.SearchFilter, server.Attr.Username))
				issue = true
			}
		}
		if !issue {
			bWriter.WriteString("No issues found\n\n")
		}
	}

	bWriter.WriteString("## LDAP configuration\n\n")

	bWriter.WriteString("```toml\n")
	errM := toml.NewEncoder(bWriter).Encode(ldapConfig)
	if errM != nil {
		bWriter.WriteString(
			fmt.Sprintf("Unable to encode LDAP configuration  \n Err: %s", err))
	}
	bWriter.WriteString("```\n\n")

	bWriter.WriteString("## Grafana LDAP configuration\n\n")

	bWriter.WriteString("```ini\n")

	bWriter.WriteString(fmt.Sprintf("enabled = %v\n", s.cfg.LDAPEnabled))
	bWriter.WriteString(fmt.Sprintf("config_file = %s\n", s.cfg.LDAPConfigFilePath))
	bWriter.WriteString(fmt.Sprintf("allow_sign_up = %v\n", s.cfg.LDAPAllowSignup))
	bWriter.WriteString(fmt.Sprintf("sync_cron = %s\n", setting.LDAPSyncCron))
	bWriter.WriteString(fmt.Sprintf("active_sync_enabled = %v\n", setting.LDAPActiveSyncEnabled))
	bWriter.WriteString(fmt.Sprintf("skip_org_role_sync = %v\n", setting.LDAPSkipOrgRoleSync))

	bWriter.WriteString("```\n\n")

	return &supportbundles.SupportItem{
		Filename:  "ldap.md",
		FileBytes: bWriter.Bytes(),
	}, nil
}
