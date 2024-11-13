package sqleng

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

func (e *DataSourceHandler) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	err := e.Ping()
	if err != nil {
		logCheckHealthError(e.dsInfo, err, e.log)
		if req.PluginContext.User.Role == "Admin" {
			return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}, nil
		}
		errResponse := &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: e.TransformQueryError(e.log, err).Error(),
		}
		return errResponse, nil
	}
	return &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "Database Connection OK"}, nil
}

func logCheckHealthError(dsInfo DataSourceInfo, err error, logger log.Logger) {
	configSummary := map[string]any{
		"config_url_length":                    len(dsInfo.URL),
		"config_user_length":                   len(dsInfo.User),
		"config_database_length":               len(dsInfo.Database),
		"config_max_open_conns":                dsInfo.JsonData.MaxOpenConns,
		"config_max_idle_conns":                dsInfo.JsonData.MaxIdleConns,
		"config_conn_max_life_time":            dsInfo.JsonData.ConnMaxLifetime,
		"config_conn_timeout":                  dsInfo.JsonData.ConnectionTimeout,
		"config_timescaledb":                   dsInfo.JsonData.Timescaledb,
		"config_ssl_mode":                      dsInfo.JsonData.Mode,
		"config_tls_configuration_method":      dsInfo.JsonData.ConfigurationMethod,
		"config_tls_skip_verify":               dsInfo.JsonData.TlsSkipVerify,
		"config_ssl_root_cert_file_length":     len(dsInfo.JsonData.RootCertFile),
		"config_ssl_cert_file_length":          len(dsInfo.JsonData.CertFile),
		"config_ssl_key_file_length":           len(dsInfo.JsonData.CertKeyFile),
		"config_timezone":                      dsInfo.JsonData.Timezone,
		"config_encrypt":                       len(dsInfo.JsonData.Encrypt),
		"config_server_name":                   len(dsInfo.JsonData.Servername),
		"config_time_interval":                 dsInfo.JsonData.TimeInterval,
		"config_database":                      len(dsInfo.JsonData.Database),
		"config_enable_secure_proxy":           dsInfo.JsonData.SecureDSProxy,
		"config_allow_clear_text_passwords":    dsInfo.JsonData.AllowCleartextPasswords,
		"config_authentication_type":           dsInfo.JsonData.AuthenticationType,
		"secure_config_password_length":        len(dsInfo.DecryptedSecureJSONData["password"]),
		"secure_config_tls_ca_cert_length":     len(dsInfo.DecryptedSecureJSONData["tlsCACert"]),
		"secure_config_tls_client_cert_length": len(dsInfo.DecryptedSecureJSONData["tlsClientCert"]),
		"secure_config_tls_client_key_length":  len(dsInfo.DecryptedSecureJSONData["tlsClientKey"]),
	}
	configSummaryJson, marshalError := json.Marshal(configSummary)
	if marshalError != nil {
		logger.Error("Check health failed", "error", err, "message_type", "ds_config_health_check_error", "plugin_id", "grafana-postgresql-datasource")
		return
	}
	logger.Error("Check health failed", "error", err, "message_type", "ds_config_health_check_detailed_error", "plugin_id", "grafana-postgresql-datasource", "details", string(configSummaryJson))
}
