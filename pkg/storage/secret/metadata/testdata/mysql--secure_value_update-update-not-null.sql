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
  `description` = 'description',
  `keeper` = 'keeper_test',
  `decrypters` = 'decrypters_test',
  `ref` = 'ref_test',
  `external_id` = 'extId'
WHERE 
  `namespace` = 'ns' AND
  `name` = 'name'
;
