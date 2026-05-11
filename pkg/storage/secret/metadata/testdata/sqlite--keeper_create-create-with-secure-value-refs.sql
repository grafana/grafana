INSERT INTO "secret_keeper" (
  "guid",
  "name",
  "namespace",
  "annotations",
  "labels",
  "created",
  "created_by",
  "updated",
  "updated_by",
  "description",
  "type",
  "payload"
)
SELECT
  'abc',
  'name',
  'ns',
  '{"x":"XXXX"}',
  '{"a":"AAA", "b", "BBBB"}',
  1234,
  'user:ryan',
  5678,
  'user:cameron',
  'description',
  'sql',
  ''
FROM
  (SELECT 1) AS "keeper_insert_check"
WHERE
  (
    SELECT COUNT(*) FROM (
      SELECT 1 FROM "secret_secure_value"
      WHERE "namespace" = 'ns'
        AND "name" IN ('a', 'b')
        AND "active" = true
        AND "keeper" = 'system'
    ) AS "sv_check"
  ) = 2
;
