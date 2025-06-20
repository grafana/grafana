SELECT
  `guid`,
  `name`,
  `namespace`,
  `annotations`,
  `labels`,
  `created`,
  `created_by`,
  `updated`,
  `updated_by`,
  `stdout_enable`,
  `file_enable`,
  `file_path`,
  `loki_enable`,
  `loki_url_secure_value_name`,
  `loki_protocol`,
  `loki_tls`
FROM
  `secret_audit_log_config`
WHERE `namespace` = 'ns'
LIMIT 1
;
