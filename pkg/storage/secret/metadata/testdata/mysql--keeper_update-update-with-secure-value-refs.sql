UPDATE
  `secret_keeper`
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
  `type` = 'sql',
  `payload` = ''
WHERE `namespace` = 'ns' AND
  `name` = 'name'
  AND (
    SELECT COUNT(*) FROM (
      SELECT 1 FROM `secret_secure_value`
      WHERE `namespace` = 'ns'
        AND `name` IN ('a', 'b')
        AND `active` = true
        AND `keeper` = 'system'
      FOR UPDATE
    ) AS `sv_check`
  ) = 2
;
