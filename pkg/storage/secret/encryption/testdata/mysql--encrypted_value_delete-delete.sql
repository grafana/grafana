DELETE FROM `secret_encrypted_value`
WHERE 
  `namespace` = 'ns' AND
  `name`      = 'n1' AND
  `version`   = 1
;
