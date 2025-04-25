INSERT INTO `secret_data_key` (
  `uid`,
  `namespace`,
  `label`,
  `provider`,
  `encrypted_data`,
  `active`,
  `created`,
  `updated`
) VALUES (
  'abc123',
  'ns',
  'test-label',
  'test-provider',
  '[115 101 99 114 101 116]',
  TRUE,
  '1969-12-31 21:20:34 -0300 -03',
  '1969-12-31 22:34:38 -0300 -03'
); 
