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

	ldapConfig := s.ldapService.Config()
	if ldapConfig != nil {
		bWriter.WriteString("## LDAP Status\n")

		ldapClient := s.ldapService.Client()

		ldapStatus, err := ldapClient.Ping()
		if err != nil {
			fmt.Fprintf(bWriter,
				"Unable to ping server\n Err: %s", err)
		}

		for _, server := range ldapStatus {
			fmt.Fprintf(bWriter, "\nHost: %s  \n", server.Host)
			fmt.Fprintf(bWriter, "Port: %d  \n", server.Port)
			fmt.Fprintf(bWriter, "Available: %v  \n", server.Available)
			if server.Error != nil {
				fmt.Fprintf(bWriter, "Error: %s\n", server.Error)
			}
		}

		bWriter.WriteString("\n## LDAP Common Configuration issues\n\n")
		bWriter.WriteString("- Checked for **Mismatched search attributes**\n\n")
		issue := false
		for _, server := range ldapConfig.Servers {
			server.BindPassword = "********" // censor password on config dump
			server.ClientKey = "********"    // censor client key on config dump
			server.ClientKeyValue = "********"

			if !strings.Contains(server.SearchFilter, server.Attr.Username) {
				fmt.Fprintf(bWriter,
					"Search filter does not match username attribute  \n"+
						"Server: %s  \n"+
						"Search filter: %s  \n"+
						"Username attribute: %s  \n",
					server.Host, server.SearchFilter, server.Attr.Username)
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
		fmt.Fprintf(bWriter,
			"Unable to encode LDAP configuration  \n Err: %s", errM)
	}
	bWriter.WriteString("```\n\n")

	bWriter.WriteString("## Grafana LDAP configuration\n\n")

	bWriter.WriteString("```ini\n")

	fmt.Fprintf(bWriter, "enabled = %v\n", s.cfg.Enabled)
	fmt.Fprintf(bWriter, "config_file = %s\n", s.cfg.ConfigFilePath)
	fmt.Fprintf(bWriter, "allow_sign_up = %v\n", s.cfg.AllowSignUp)
	fmt.Fprintf(bWriter, "sync_cron = %s\n", s.cfg.SyncCron)
	fmt.Fprintf(bWriter, "active_sync_enabled = %v\n", s.cfg.ActiveSyncEnabled)
	fmt.Fprintf(bWriter, "skip_org_role_sync = %v\n", s.cfg.SkipOrgRoleSync)

	bWriter.WriteString("```\n\n")

	return &supportbundles.SupportItem{
		Filename:  "ldap.md",
		FileBytes: bWriter.Bytes(),
	}, nil
}
