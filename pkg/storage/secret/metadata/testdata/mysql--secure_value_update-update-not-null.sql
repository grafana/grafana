UPDATE
  `secret_secure_value`
SET
  `guid` = 'abc',
  `name` = 'name',
  `namespace` = 'ns',
  `annotations` = '{"x":"XXXX"}',
  `labels` = '{"a":"AAA", "b", "BBBB"}',
  `created` = 1234,
  `created_by` = 'user:ryan',
  `updated` = 5678,
  `updated_by` = 'user:cameron',
  `status_phase` = 'creating',
  `status_message` = '{message_test true}',
  `description` = 'description',
  `keeper` = '{keeper_test true}',
  `decrypters` = '{decrypters_test true}',
  `ref` = '{ref_test true}',
  `external_id` = 'extId'
WHERE 1 = 1 AND
  `namespace` = 'ns' AND
  `name` = 'name'
;
