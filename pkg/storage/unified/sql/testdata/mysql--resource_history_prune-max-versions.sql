DELETE FROM `resource_history`
WHERE `guid` IN (
  SELECT `guid`
  FROM (
  SELECT
    `guid`,
    ROW_NUMBER() OVER (
      PARTITION BY `namespace`
        , `group`
        , `resource`
        , `name`
      ORDER BY `resource_version` DESC
    ) AS `rn`
  FROM `resource_history`
  WHERE `namespace` = 'default'
    AND `group` = 'provisioning.grafana.app'
    AND `resource` = 'repositories'
    AND `name` = 'repo-xyz'
  ) AS `ranked`
  WHERE `rn` > 10
);
