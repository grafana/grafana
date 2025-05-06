UPDATE
  `secret_secure_value`
SET
  `status_phase` = 'Succeeded'
WHERE `namespace` = 'ns' AND
  `name` = 'name'
;
