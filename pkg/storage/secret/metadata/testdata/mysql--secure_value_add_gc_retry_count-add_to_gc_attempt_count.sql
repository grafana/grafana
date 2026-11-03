UPDATE `secret_secure_value`
SET `gc_attempts` = `gc_attempts` + 1
WHERE 
  (`namespace`, `name`, `version`) IN
  (
      (
        'ns1',
        'n1',
        1
      )
        ,
      (
        'ns1',
        'n2',
        2
      )
  ) 
  AND
  `active` = FALSE
