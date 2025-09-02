DELETE FROM 
  `secret_secure_value`
WHERE 
  `namespace` = 'ns' AND
  `name` = 'name' AND
  `version` = 1
;
