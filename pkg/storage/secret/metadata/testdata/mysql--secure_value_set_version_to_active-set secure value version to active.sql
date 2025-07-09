UPDATE
  `secret_secure_value`
SET
  `active` = (`version` = 1)
WHERE 
  `namespace` = 'ns' AND
  `name` = 'name'
;
