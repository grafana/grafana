package postgres

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
	"github.com/lib/pq"
)

func GenerateConnectionString(dsInfo sqleng.DataSourceInfo, tlsManager tlsSettingsProvider, logger log.Logger) (string, error) {
	connStr, err := getInitialConnectionString(dsInfo, logger)
	if err != nil {
		return connStr, err
	}
	return getTLSIncludedConnectionString(connStr, tlsManager, dsInfo, logger)
}

func getInitialConnectionString(dsInfo sqleng.DataSourceInfo, logger log.Logger) (string, error) {
	if dsInfo.JsonData.ConnectionType == sqleng.ConnectionTypeConnectionString {
		return dsInfo.DecryptedSecureJSONData["connectionString"], validateConnectionString(dsInfo)
	}
	var host string
	var port int
	if strings.HasPrefix(dsInfo.URL, "/") {
		host = dsInfo.URL
		logger.Debug("Generating connection string with Unix socket specifier", "address", dsInfo.URL)
	} else {
		index := strings.LastIndex(dsInfo.URL, ":")
		v6Index := strings.Index(dsInfo.URL, "]")
		sp := strings.SplitN(dsInfo.URL, ":", 2)
		host = sp[0]
		if v6Index == -1 {
			if len(sp) > 1 {
				var err error
				port, err = strconv.Atoi(sp[1])
				if err != nil {
					logger.Debug("Error parsing the IPv4 address", "address", dsInfo.URL)
					return "", sqleng.ErrParsingPostgresURL
				}
				logger.Debug("Generating IPv4 connection string with network host/port pair", "host", host, "port", port, "address", dsInfo.URL)
			} else {
				logger.Debug("Generating IPv4 connection string with network host", "host", host, "address", dsInfo.URL)
			}
		} else {
			if index == v6Index+1 {
				host = dsInfo.URL[1 : index-1]
				var err error
				port, err = strconv.Atoi(dsInfo.URL[index+1:])
				if err != nil {
					logger.Debug("Error parsing the IPv6 address", "address", dsInfo.URL)
					return "", sqleng.ErrParsingPostgresURL
				}
				logger.Debug("Generating IPv6 connection string with network host/port pair", "host", host, "port", port, "address", dsInfo.URL)
			} else {
				host = dsInfo.URL[1 : len(dsInfo.URL)-1]
				logger.Debug("Generating IPv6 connection string with network host", "host", host, "address", dsInfo.URL)
			}
		}
	}

	connStr := fmt.Sprintf("user='%s' password='%s' host='%s' dbname='%s'",
		escape(dsInfo.User), escape(dsInfo.DecryptedSecureJSONData["password"]), escape(host), escape(dsInfo.Database))
	if port > 0 {
		connStr += fmt.Sprintf(" port=%d", port)
	}
	return connStr, nil
}

func getTLSIncludedConnectionString(connStr string, tlsManager tlsSettingsProvider, dsInfo sqleng.DataSourceInfo, logger log.Logger) (string, error) {
	tlsSettings, err := tlsManager.getTLSSettings(dsInfo)
	if err != nil {
		return "", err
	}

	if dsInfo.JsonData.ConnectionType == sqleng.ConnectionTypeConnectionString {
		connStr, err = removeTLSSettingsFromConnectionString(connStr)
		if err != nil {
			return connStr, err
		}
	}

	connStr += fmt.Sprintf(" sslmode='%s'", escape(string(tlsSettings.Mode)))

	// there is an issue with the lib/pq module, the `verify-ca` tls mode
	// does not work correctly. ( see https://github.com/lib/pq/issues/1106 )
	// to workaround the problem, if the `verify-ca` mode is chosen,
	// we disable sslsni.
	if tlsSettings.Mode == TLSModeVerifyCA {
		connStr += " sslsni=0"
	}

	// Attach root certificate if provided
	if tlsSettings.RootCertFile != "" {
		logger.Debug("Setting server root certificate", "tlsRootCert", tlsSettings.RootCertFile)
		connStr += fmt.Sprintf(" sslrootcert='%s'", escape(tlsSettings.RootCertFile))
	}

	// Attach client certificate and key if both are provided
	if tlsSettings.CertFile != "" && tlsSettings.CertKeyFile != "" {
		logger.Debug("Setting TLS/SSL client auth", "tlsCert", tlsSettings.CertFile, "tlsKey", tlsSettings.CertKeyFile)
		connStr += fmt.Sprintf(" sslcert='%s' sslkey='%s'", escape(tlsSettings.CertFile), escape(tlsSettings.CertKeyFile))
	} else if tlsSettings.CertFile != "" || tlsSettings.CertKeyFile != "" {
		return "", fmt.Errorf("TLS/SSL client certificate and key must both be specified")
	}
	return connStr, nil
}

func validateConnectionString(dsInfo sqleng.DataSourceInfo) error {
	connectionString := strings.ToLower(dsInfo.DecryptedSecureJSONData["connectionString"])
	if dsInfo.JsonData.ConnectionType == sqleng.ConnectionTypeConnectionString && strings.TrimSpace(connectionString) == "" {
		return errors.New("invalid / empty connection string")
	}
	return nil
}

func removeTLSSettingsFromConnectionString(connStr string) (string, error) {
	sslPrefixes := []string{"sslmode", "sslsni", "sslrootcert", "sslcert", "sslkey"}
	parsedConnectionString, err := pq.ParseURL(connStr)
	if err != nil {
		return "", err
	}
	kv := strings.Split(parsedConnectionString, " ")
	newKv := []string{}
	for _, v := range kv {
		lowerV := strings.ToLower(v)
		isSSLParam := false
		for _, prefix := range sslPrefixes {
			if strings.HasPrefix(lowerV, prefix) {
				isSSLParam = true
				break
			}
		}
		if !isSSLParam {
			newKv = append(newKv, v)
		}
	}
	return strings.Join(newKv, " "), nil
}
