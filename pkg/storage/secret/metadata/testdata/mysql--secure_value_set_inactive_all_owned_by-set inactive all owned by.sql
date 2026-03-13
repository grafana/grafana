UPDATE
  `secret_secure_value`
SET
  `active` = false
WHERE
  `namespace` = 'ns' AND
  `owner_reference_api_group` = 'prometheus.datasource.grafana.app' AND
  `owner_reference_api_version` = 'v0alpha1' AND
  `owner_reference_kind` = 'DataSource' AND
  `owner_reference_name` = 'prom-config' AND
  `active` = true
;
