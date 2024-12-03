SELECT
  `namespace`,
  `group`,
  `resource`,
  COUNT(*),
  `resource_version`
FROM `resource`
GROUP BY 
  `namespace`,
  `group`,
  `resource`
ORDER BY
  `resource_version` desc
;
