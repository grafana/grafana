SELECT
  `name` 
FROM
  `secret_secure_value`
WHERE 
  `namespace` = 'ns' AND
  `active` = true AND
  `owner_reference_api_version` IS NOT NULL AND `owner_reference_api_version` != '' AND
  `owner_reference_kind` IS NOT NULL AND `owner_reference_kind` != '' AND
  `owner_reference_name` IS NOT NULL AND `owner_reference_name` != '' AND
  `owner_reference_uid` IS NOT NULL AND `owner_reference_uid` != '' AND
  `owner_reference_api_version` = 'prometheus.datasource.grafana.com/v1alpha1' AND
  `owner_reference_kind` = 'DataSourceConfig' AND
  `owner_reference_name` = 'prom-config' AND
  `owner_reference_uid` = '1234'
;
