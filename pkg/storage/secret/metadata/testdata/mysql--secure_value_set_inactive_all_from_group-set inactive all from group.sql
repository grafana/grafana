UPDATE
  `secret_secure_value`
SET
  `active` = false
WHERE
  `namespace` = 'ns' AND
  `owner_reference_api_group` = 'prometheus.datasource.grafana.app' AND
  `active` = true
;
