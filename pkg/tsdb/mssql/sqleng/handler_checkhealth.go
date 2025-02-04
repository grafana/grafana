package sqleng

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

func (e *DataSourceHandler) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if err := e.db.Ping(); err != nil {
		logCheckHealthError(ctx, e.dsInfo, err)
		if strings.EqualFold(req.PluginContext.User.Role, "Admin") {
			return ErrToHealthCheckResult(err)
		}
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: e.TransformQueryError(e.log, err).Error()}, nil
	}
	return &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "Database Connection OK"}, nil
}

// ErrToHealthCheckResult converts error into user friendly health check message
// This should be called with non nil error. If the err parameter is empty, we will send Internal Server Error
func ErrToHealthCheckResult(err error) (*backend.CheckHealthResult, error) {
	if err == nil {
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: "Internal Server Error"}, nil
	}
	res := &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}
	details := map[string]string{
		"verboseMessage":   err.Error(),
		"errorDetailsLink": "https://grafana.com/docs/grafana/latest/datasources/mssql",
	}
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		res.Message = "Network error: Failed to connect to the server"
		if opErr != nil && opErr.Err != nil {
			errMessage := opErr.Err.Error()
			if strings.HasSuffix(opErr.Err.Error(), "no such host") {
				errMessage = "no such host"
			}
			if strings.HasSuffix(opErr.Err.Error(), "unknown port") {
				errMessage = "unknown port"
			}
			if strings.HasSuffix(opErr.Err.Error(), "invalid port") {
				errMessage = "invalid port"
			}
			if strings.HasSuffix(opErr.Err.Error(), "missing port in address") {
				errMessage = "missing port in address"
			}
			if strings.HasSuffix(opErr.Err.Error(), "invalid syntax") {
				errMessage = "invalid syntax found in the address"
			}
			res.Message += fmt.Sprintf(". Error message: %s", errMessage)
		}
	}
	if strings.HasPrefix(err.Error(), "mssql: ") {
		res.Message = "Database error: Failed to connect to the mssql server"
		if unwrappedErr := errors.Unwrap(err); unwrappedErr != nil {
			details["verboseMessage"] = unwrappedErr.Error()
		}
	}
	detailBytes, marshalErr := json.Marshal(details)
	if marshalErr != nil {
		return res, nil
	}
	res.JSONDetails = detailBytes
	return res, nil
}

func logCheckHealthError(ctx context.Context, dsInfo DataSourceInfo, err error) {
	logger := log.DefaultLogger.FromContext(ctx)
	configSummary := map[string]any{
		"config_url_length":                 len(dsInfo.URL),
		"config_user_length":                len(dsInfo.User),
		"config_database_length":            len(dsInfo.Database),
		"config_json_data_database_length":  len(dsInfo.JsonData.Database),
		"config_max_open_conns":             dsInfo.JsonData.MaxOpenConns,
		"config_max_idle_conns":             dsInfo.JsonData.MaxIdleConns,
		"config_conn_max_life_time":         dsInfo.JsonData.ConnMaxLifetime,
		"config_conn_timeout":               dsInfo.JsonData.ConnectionTimeout,
		"config_ssl_mode":                   dsInfo.JsonData.Mode,
		"config_tls_configuration_method":   dsInfo.JsonData.ConfigurationMethod,
		"config_tls_skip_verify":            dsInfo.JsonData.TlsSkipVerify,
		"config_timezone":                   dsInfo.JsonData.Timezone,
		"config_time_interval":              dsInfo.JsonData.TimeInterval,
		"config_enable_secure_proxy":        dsInfo.JsonData.SecureDSProxy,
		"config_allow_clear_text_passwords": dsInfo.JsonData.AllowCleartextPasswords,
		"config_authentication_type":        dsInfo.JsonData.AuthenticationType,
		"config_ssl_root_cert_file_length":  len(dsInfo.JsonData.RootCertFile),
		"config_ssl_cert_file_length":       len(dsInfo.JsonData.CertFile),
		"config_ssl_key_file_length":        len(dsInfo.JsonData.CertKeyFile),
		"config_encrypt_length":             len(dsInfo.JsonData.Encrypt),
		"config_server_name_length":         len(dsInfo.JsonData.Servername),
		"config_password_length":            len(dsInfo.DecryptedSecureJSONData["password"]),
		"config_tls_ca_cert_length":         len(dsInfo.DecryptedSecureJSONData["tlsCACert"]),
		"config_tls_client_cert_length":     len(dsInfo.DecryptedSecureJSONData["tlsClientCert"]),
		"config_tls_client_key_length":      len(dsInfo.DecryptedSecureJSONData["tlsClientKey"]),
	}
	configSummaryJson, marshalError := json.Marshal(configSummary)
	if marshalError != nil {
		logger.Error("Check health failed", "error", err, "message_type", "ds_config_health_check_error")
		return
	}
	logger.Error("Check health failed", "error", err, "message_type", "ds_config_health_check_error_detailed", "details", string(configSummaryJson))
}
