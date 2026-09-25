SELECT DISTINCT
  `namespace`,
  `group`,
  `resource`
FROM `resource`
WHERE 1 = 1
ORDER BY
  `namespace`,
  `group`,
  `resource`
;
