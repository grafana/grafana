package sqleng

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/mssql/azure"
	"github.com/grafana/grafana/pkg/tsdb/mssql/kerberos"
	"github.com/grafana/grafana/pkg/tsdb/mssql/utils"
	"github.com/grafana/grafana/pkg/util"
	mssql "github.com/microsoft/go-mssqldb"
	"github.com/microsoft/go-mssqldb/azuread"
)

func newMSSQL(ctx context.Context, driverName string, rowLimit int64, dsInfo DataSourceInfo, cnnstr string, logger log.Logger, settings backend.DataSourceInstanceSettings) (*sql.DB, error) {
	var connector *mssql.Connector
	var err error
	if driverName == "azuresql" {
		connector, err = azuread.NewConnector(cnnstr)
	} else {
		connector, err = mssql.NewConnector(cnnstr)
	}

	if err != nil {
		logger.Error("mssql connector creation failed", "error", err)
		return nil, fmt.Errorf("mssql connector creation failed")
	}

	proxyClient, err := settings.ProxyClient(ctx)
	if err != nil {
		logger.Error("mssql proxy creation failed", "error", err)
		return nil, fmt.Errorf("mssql proxy creation failed")
	}

	if proxyClient.SecureSocksProxyEnabled() {
		dialer, err := proxyClient.NewSecureSocksProxyContextDialer()
		if err != nil {
			logger.Error("mssql proxy creation failed", "error", err)
			return nil, fmt.Errorf("mssql proxy creation failed")
		}
		URL, err := utils.ParseURL(dsInfo.URL, logger)
		if err != nil {
			return nil, err
		}

		mssqlDialer, err := newMSSQLProxyDialer(URL.Hostname(), dialer)
		if err != nil {
			return nil, err
		}
		// update the mssql dialer with the proxy dialer
		connector.Dialer = (mssqlDialer)
	}

	config := DataPluginConfiguration{
		DSInfo:            dsInfo,
		MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
		RowLimit:          rowLimit,
	}

	db := sql.OpenDB(connector)

	db.SetMaxOpenConns(config.DSInfo.JsonData.MaxOpenConns)
	db.SetMaxIdleConns(config.DSInfo.JsonData.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(config.DSInfo.JsonData.ConnMaxLifetime) * time.Second)

	return db, nil
}

const (
	azureAuthentication         = "Azure AD Authentication"
	windowsAuthentication       = "Windows Authentication"
	sqlServerAuthentication     = "SQL Server Authentication"
	kerberosRaw                 = "Windows AD: Username + password"
	kerberosKeytab              = "Windows AD: Keytab"
	kerberosCredentialCache     = "Windows AD: Credential cache"      // #nosec G101
	kerberosCredentialCacheFile = "Windows AD: Credential cache file" // #nosec G101
)

func generateConnectionString(dsInfo DataSourceInfo, azureManagedIdentityClientId string, azureEntraPasswordCredentialsEnabled bool, azureCredentials azcredentials.AzureCredentials, kerberosAuth kerberos.KerberosAuth, logger log.Logger) (string, error) {
	const dfltPort = "0"
	var addr util.NetworkAddress
	if dsInfo.URL != "" {
		u, err := utils.ParseURL(dsInfo.URL, logger)
		if err != nil {
			return "", err
		}
		addr, err = util.SplitHostPortDefault(u.Host, "localhost", dfltPort)
		if err != nil {
			return "", err
		}
	} else {
		addr = util.NetworkAddress{
			Host: "localhost",
			Port: dfltPort,
		}
	}

	args := []any{
		"url", dsInfo.URL, "host", addr.Host,
	}
	if addr.Port != "0" {
		args = append(args, "port", addr.Port)
	}
	logger.Debug("Generating connection string", args...)

	encrypt := dsInfo.JsonData.Encrypt
	tlsSkipVerify := dsInfo.JsonData.TlsSkipVerify
	hostNameInCertificate := dsInfo.JsonData.Servername
	certificate := dsInfo.JsonData.RootCertFile
	connStr := fmt.Sprintf("server=%s;database=%s;",
		addr.Host,
		dsInfo.Database,
	)

	switch dsInfo.JsonData.AuthenticationType {
	case azureAuthentication:
		azureCredentialDSNFragment, err := azure.GetAzureCredentialDSNFragment(azureCredentials, azureManagedIdentityClientId, azureEntraPasswordCredentialsEnabled)
		if err != nil {
			return "", err
		}
		connStr += azureCredentialDSNFragment
	case windowsAuthentication:
		// No user id or password. We're using windows single sign on.
	case kerberosRaw, kerberosKeytab, kerberosCredentialCacheFile, kerberosCredentialCache:
		connStr = kerberos.Krb5ParseAuthCredentials(addr.Host, addr.Port, dsInfo.Database, dsInfo.User, dsInfo.DecryptedSecureJSONData["password"], kerberosAuth)
	default:
		connStr += fmt.Sprintf("user id=%s;password=%s;", dsInfo.User, dsInfo.DecryptedSecureJSONData["password"])
	}

	// Port number 0 means to determine the port automatically, so we can let the driver choose
	if addr.Port != "0" {
		connStr += fmt.Sprintf("port=%s;", addr.Port)
	}
	switch encrypt {
	case "true":
		connStr += fmt.Sprintf("encrypt=%s;TrustServerCertificate=%t;", encrypt, tlsSkipVerify)
		if hostNameInCertificate != "" {
			connStr += fmt.Sprintf("hostNameInCertificate=%s;", hostNameInCertificate)
		}

		if certificate != "" {
			connStr += fmt.Sprintf("certificate=%s;", certificate)
		}
	case "disable":
		connStr += fmt.Sprintf("encrypt=%s;", dsInfo.JsonData.Encrypt)
	}

	if dsInfo.JsonData.ConnectionTimeout != 0 {
		connStr += fmt.Sprintf("connection timeout=%d;", dsInfo.JsonData.ConnectionTimeout)
	}

	return connStr, nil
}
