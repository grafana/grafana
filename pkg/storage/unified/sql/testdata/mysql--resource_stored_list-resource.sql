SELECT DISTINCT
  `namespace`,
  `group`,
  `resource`
FROM `resource`
WHERE 1 = 1
  AND `namespace` = 'default'
  AND `group` = 'dashboard.grafana.app'
  AND `resource` = 'dashboards'
ORDER BY
  `namespace`,
  `group`,
  `resource`
;
