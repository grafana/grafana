UPDATE "secret_keeper" (
  "guid" = 'abc',
  "name" = 'name',
  "namespace" = 'ns',
  "annotations" = '{"x":"XXXX"}',
  "labels" = '{"a":"AAA", "b", "BBBB"}',
  "created" = 1234,
  "created_by" = 'user:ryan',
  "updated" = 5678,
  "updated_by" = 'user:cameron',
  "title" = 'title',
  "type" = 'sql',
  "payload" = ''
)
WHERE
  "name" = 'name' AND
  "namespace"= 'ns'
;
