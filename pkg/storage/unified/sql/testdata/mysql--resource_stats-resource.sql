SELECT
  `namespace`,
  `group`,
  `resource`,
  COUNT(*),
  MAX(`resource_version`)
FROM `resource`
WHERE 1 = 1
  AND `namespace` = 'default'
  AND `group` = 'dashboard.grafana.app'
  AND `resource` = 'dashboards'
GROUP BY 
  `namespace`,
  `group`,
  `resource`
;
