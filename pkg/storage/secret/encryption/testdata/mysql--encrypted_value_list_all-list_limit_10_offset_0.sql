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
ORDER BY `created` ASC
LIMIT 10 OFFSET 0
;
