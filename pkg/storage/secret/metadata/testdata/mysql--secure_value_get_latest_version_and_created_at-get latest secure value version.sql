SELECT
  `created`,
  `version`,
  `active`,
  `namespace`,
  `name`
FROM
  `secret_secure_value`
WHERE 
  `namespace` = 'ns' AND
  `name` = 'name'
ORDER BY `version` DESC
LIMIT 1
;
