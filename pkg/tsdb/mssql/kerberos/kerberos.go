package kerberos

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
)

type KerberosLookup struct {
	User                    string `json:"user"`
	DBName                  string `json:"database"`
	Address                 string `json:"address"`
	CredentialCacheFilename string `json:"credentialCache"`
}

type KerberosAuth struct {
	KeytabFilePath            string
	CredentialCache           string
	CredentialCacheLookupFile string
	ConfigFilePath            string
	UDPConnectionLimit        string
	EnableDNSLookupKDC        string
}

func GetKerberosSettings(settings backend.DataSourceInstanceSettings) (kerberosAuth KerberosAuth, err error) {
	err = json.Unmarshal(settings.JSONData, &kerberosAuth)
	return kerberosAuth, err
}

func Krb5ParseAuthCredentials(host string, port string, db string, user string, pass string, kerberosAuth KerberosAuth) string {
	//params for driver conn str
	//More details: https://github.com/microsoft/go-mssqldb#kerberos-active-directory-authentication-outside-windows

	krb5CCLookupFile := kerberosAuth.CredentialCacheLookupFile
	krb5CacheCredsFile := kerberosAuth.CredentialCache

	// if there is a lookup file specified, use it to find the correct credential cache file and overwrite var
	// getCredentialCacheFromLookup implementation taken from mysql kerberos solution - https://github.com/grafana/mysql/commit/b5e73c8d536150c054d310123643683d3b18f0da
	if krb5CCLookupFile != "" {
		krb5CacheCredsFile = getCredentialCacheFromLookup(krb5CCLookupFile, host, port, db, user)
		if krb5CacheCredsFile == "" {
			logger.Error("No valid credential cache file found in lookup.")
			return ""
		}
	}

	krb5DriverParams := fmt.Sprintf("authenticator=krb5;krb5-configfile=%s;", kerberosAuth.ConfigFilePath)

	// There are 3 main connection types:
	// - credentials cache
	// - user, realm, keytab
	// - realm, user, pass
	if krb5CacheCredsFile != "" {
		krb5DriverParams += fmt.Sprintf("server=%s;database=%s;krb5-credcachefile=%s;", host, db, krb5CacheCredsFile)
	} else if kerberosAuth.KeytabFilePath != "" {
		krb5DriverParams += fmt.Sprintf("server=%s;database=%s;user id=%s;krb5-keytabfile=%s;", host, db, user, kerberosAuth.KeytabFilePath)
	} else if kerberosAuth.KeytabFilePath == "" {
		krb5DriverParams += fmt.Sprintf("server=%s;database=%s;user id=%s;password=%s;", host, db, user, pass)
	} else {
		logger.Error("invalid kerberos configuration")
		return ""
	}

	if kerberosAuth.UDPConnectionLimit != "" {
		krb5DriverParams += "krb5-udppreferencelimit=" + kerberosAuth.UDPConnectionLimit + ";"
	}

	if kerberosAuth.EnableDNSLookupKDC != "" {
		krb5DriverParams += "krb5-dnslookupkdc=" + kerberosAuth.EnableDNSLookupKDC + ";"
	}

	return krb5DriverParams
}

func getCredentialCacheFromLookup(lookupFile string, host string, port string, dbName string, user string) string {
	logger.Info(fmt.Sprintf("reading credential cache lookup: %s", lookupFile))
	content, err := os.ReadFile(filepath.Clean(lookupFile))
	if err != nil {
		logger.Error(fmt.Sprintf("error reading: %s, %v", lookupFile, err))
		return ""
	}
	var lookups []KerberosLookup
	err = json.Unmarshal(content, &lookups)
	if err != nil {
		logger.Error(fmt.Sprintf("error parsing: %s, %v", lookupFile, err))
		return ""
	}
	// find cache file
	for _, item := range lookups {
		if port == "0" {
			item.Address = host + ":0"
		}
		if item.Address == host+":"+port && item.DBName == dbName && item.User == user {
			logger.Info(fmt.Sprintf("matched: %+v", item))
			return item.CredentialCacheFilename
		}
	}
	logger.Error(fmt.Sprintf("no match found for %s", host+":"+port))
	return ""
}
