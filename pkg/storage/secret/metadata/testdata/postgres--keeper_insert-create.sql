INSERT INTO "secure_value" (
  "guid",
  "name", "namespace", "annotations",
  "labels",
  "created", "created_by",
  "updated", "updated_by",
  "title", "type", "payload"
)
VALUES (
         'abc',
         'name', 'ns', '{"x":"XXXX"}',
         '{"a":"AAA", "b", "BBBB"}',
         1234, 'user:ryan',
         5678, 'user:cameron',
         'title', 'sql',
         ''
       )
;
