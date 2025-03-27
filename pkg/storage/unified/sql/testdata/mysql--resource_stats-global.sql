SELECT
  `namespace`,
  `group`,
  `resource`,
  COUNT(*),
  MAX(`resource_version`)
FROM `resource`
WHERE 1 = 1
GROUP BY 
  `namespace`,
  `group`,
  `resource`
;
