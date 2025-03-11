INSERT INTO `resource`
SELECT 
  kv.`guid`,
  kv.`resource_version`,
  kv.`group`, 
  kv.`resource`, 
  kv.`namespace`,   
  kv.`name`,
  kv.`value`,
  kv.`action`,
  kv.`label_set`,
  kv.`previous_resource_version`,
  kv.`folder`
FROM `resource_history` AS kv
  INNER JOIN  (
    SELECT `namespace`, `group`, `resource`, `name`,  max(`resource_version`) AS `resource_version`
    FROM `resource_history` AS mkv
    WHERE 1 = 1
      AND `namespace` = 'default'
      AND `group`     = 'dashboard.grafana.app'
      AND `resource`  = 'dashboards'
    GROUP BY mkv.`namespace`, mkv.`group`, mkv.`resource`, mkv.`name` 
  ) AS maxkv
       ON maxkv.`resource_version` = kv.`resource_version`
      AND maxkv.`namespace` = kv.`namespace`
      AND maxkv.`group`     = kv.`group`
      AND maxkv.`resource`  = kv.`resource`
      AND maxkv.`name`      = kv.`name`
    WHERE kv.`action`   != 3 
      AND kv.`namespace` = 'default'
      AND kv.`group`     = 'dashboard.grafana.app'
      AND kv.`resource`  = 'dashboards'
    ORDER BY kv.`resource_version` ASC
;
