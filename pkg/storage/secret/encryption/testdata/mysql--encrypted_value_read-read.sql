SELECT
  `namespace`,
  `name`,
  `version`,
  `encrypted_data`,
  `data_key_id`,
  `created`,
  `updated`
FROM
  `secret_encrypted_value`
WHERE 
  `namespace` = 'ns' AND
  `name` = 'n1' AND
  `version` = 1
;
