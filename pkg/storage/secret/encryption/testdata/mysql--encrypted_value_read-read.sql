SELECT
  `uid`,
  `namespace`,
  `encrypted_data`,
  `created`,
  `updated`
FROM
  `secret_encrypted_value`
WHERE 1 = 1 AND
  `namespace` = 'ns' AND
  `uid` = 'abc123'
;
