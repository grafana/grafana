INSERT INTO `secret_secure_value_outbox` (
  `request_id`,
  `message_type`,
  `name`,
  `namespace`,
  `keeper_name`,
  `external_id`,
  `receive_count`,
  `created`
) VALUES (
  '',
  'some-type',
  'name',
  'namespace',
  'keeper',
  'external-id',
  0,
  1234
) ;
