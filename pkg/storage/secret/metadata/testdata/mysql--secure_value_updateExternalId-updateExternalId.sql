UPDATE
  `secret_secure_value`
SET
  `external_id` = 'extId'
WHERE 
  `namespace` = 'ns' AND
  `name` = 'name' AND
  `version` = 0
;
