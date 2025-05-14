INSERT INTO `secret_secure_value_outbox` (
  `uid`,
  `message_type`,
  `name`,
  `namespace`,
  `keeper_name`,
  `external_id`,
  `created`
) VALUES (
  'my-uuid',
  'some-type',
  'name',
  'namespace',
  'keeper',
  'external-id',
  1234
);
