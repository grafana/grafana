SELECT COUNT(1) > 0
FROM `secret_secure_value`
WHERE
  `namespace` = 'ns' AND
  `keeper` = 'name'
LIMIT 1
