INSERT INTO `secret_encrypted_value` (
  `namespace`,
  `name`,
  `version`,
  `encrypted_data`,
  `data_key_id`,
  `created`,
  `updated`
) VALUES (
  'ns',
  'n1',
  1,
  '[115 101 99 114 101 116]',
  'test-data-key-id',
  1234,
  5678
);
