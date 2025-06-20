INSERT INTO "secret_audit_log_config" (
  "guid",
  "name",
  "namespace",
  "annotations",
  "labels",
  "created",
  "created_by",
  "updated",
  "updated_by",
  "stdout_enable",
  "file_enable",
  "loki_enable"
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
  TRUE,
  FALSE,
  FALSE
);
