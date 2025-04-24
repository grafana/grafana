UPDATE
  `secret_secure_value`
SET
  `status_phase` = 'Succeeded'
WHERE 1 = 1 AND
  `namespace` = 'ns' AND
  `name` = 'name'
;
