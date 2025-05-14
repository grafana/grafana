INSERT INTO `secret_secure_value_outbox` (
  `uid`,
  `message_type`,
  `name`,
  `namespace`,
  `encrypted_secret`,
  `keeper_name`,
  `created`
) VALUES (
  'my-uuid',
  'some-type',
  'name',
  'namespace',
  'encrypted',
  'keeper',
  1234
);
