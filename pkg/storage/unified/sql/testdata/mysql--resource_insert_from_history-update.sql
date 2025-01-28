INSERT INTO `resource`
SELECT 
  mkv.`guid`,
  max(`resource_version`) AS `resource_version`,
  mkv.`group`, 
  mkv.`resource`, 
  mkv.`namespace`,   
  mkv.`name`,
  mkv.`value`,
  mkv.`action`,
  mkv.`label_set`,
  mkv.`previous_resource_version`,
  mkv.`folder`
FROM `resource_history` AS mkv
WHERE `action` != 3
  AND `namespace` = 'default'
  AND `group`     = 'dashboard.grafana.app'
  AND `resource`  = 'dashboards'
GROUP BY 
  mkv.`namespace`, 
  mkv.`group`, 
  mkv.`resource`, 
  mkv.`name`,
  mkv.`guid` 
ORDER BY resource_version ASC
;
