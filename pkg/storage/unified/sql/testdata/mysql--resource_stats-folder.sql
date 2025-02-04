SELECT
  `namespace`,
  `group`,
  `resource`,
  COUNT(*),
  MAX(`resource_version`)
FROM `resource`
WHERE 1 = 1
  AND `namespace` = 'default'
  AND `folder` = 'folder'
GROUP BY 
  `namespace`,
  `group`,
  `resource`
;
