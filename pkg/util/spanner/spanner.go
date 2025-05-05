// Package spanner should only be used from tests, or from enterprise code (eg. protected by build tags).
package spanner

import (
	"strconv"

	spannerdriver "github.com/googleapis/go-sql-spanner"
	"google.golang.org/api/option"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func UsePlainText(connectorConfig spannerdriver.ConnectorConfig) bool {
	if strval, ok := connectorConfig.Params["useplaintext"]; ok {
		if val, err := strconv.ParseBool(strval); err == nil {
			return val
		}
	}
	return false
}

// ConnectorConfigToClientOptions is adapted from https://github.com/googleapis/go-sql-spanner/blob/main/driver.go#L341-L477, from version 1.11.1.
func ConnectorConfigToClientOptions(connectorConfig spannerdriver.ConnectorConfig) []option.ClientOption {
	var opts []option.ClientOption
	if connectorConfig.Host != "" {
		opts = append(opts, option.WithEndpoint(connectorConfig.Host))
	}
	if strval, ok := connectorConfig.Params["credentials"]; ok {
		opts = append(opts, option.WithCredentialsFile(strval))
	}
	if strval, ok := connectorConfig.Params["credentialsjson"]; ok {
		opts = append(opts, option.WithCredentialsJSON([]byte(strval)))
	}
	if UsePlainText(connectorConfig) {
		opts = append(opts,
			option.WithGRPCDialOption(grpc.WithTransportCredentials(insecure.NewCredentials())),
			option.WithoutAuthentication())
	}
	return opts
}
