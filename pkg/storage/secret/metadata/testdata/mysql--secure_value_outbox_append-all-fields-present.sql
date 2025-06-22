INSERT INTO `secret_secure_value_outbox` (
  `request_id`,
  `uid`,
  `message_type`,
  `name`,
  `namespace`,
  `encrypted_secret`,
  `keeper_name`,
  `external_id`,
  `receive_count`,
  `created`
) VALUES (
  '',
  'my-uuid',
  'some-type',
  'name',
  'namespace',
  'encrypted',
  'keeper',
  '',
  0,
  1234
);
