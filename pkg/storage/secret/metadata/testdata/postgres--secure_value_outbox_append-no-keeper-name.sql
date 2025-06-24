INSERT INTO "secret_secure_value_outbox" (
  "request_id",
  "message_type",
  "name",
  "namespace",
  "encrypted_secret",
  "external_id",
  "receive_count",
  "created"
) VALUES (
  '',
  'some-type',
  'name',
  'namespace',
  'encrypted',
  'external-id',
  0,
  1234
) RETURNING id;
