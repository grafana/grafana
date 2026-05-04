UPDATE `secret_secure_value`
SET `gc_attempts` = `gc_attempts` + 1
WHERE 
  `guid` IN ('1', '2') AND
  `active` = FALSE
