UPDATE
  `secret_encrypted_value`
SET
  `encrypted_data` = '[115 101 99 114 101 116]',
  `update` = 5679,
WHERE 1 = 1 AND
  `namespace` = 'ns' AND
  `uid` = 'abc123'
;
