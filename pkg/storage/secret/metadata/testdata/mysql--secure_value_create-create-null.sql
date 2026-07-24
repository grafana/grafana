INSERT INTO `secret_secure_value` (
  `guid`,
  `name`,
  `namespace`,
  `annotations`,
  `labels`,
  `created`,
  `created_by`,
  `updated`,
  `updated_by`,
  `active`,
  `version`,
  `description`,
  `external_id`
) VALUES (
  'abc',
  'name',
  'ns',
  '{"x":"XXXX"}',
  '{"a":"AAA", "b", "BBBB"}',
  1234,
  'user:ryan',
  5678,
  'user:cameron',
  FALSE,
  1,
  'description',
  'extId'
);
