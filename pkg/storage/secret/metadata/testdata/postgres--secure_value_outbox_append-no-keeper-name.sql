INSERT INTO "secret_secure_value_outbox" (
  "uid",
  "message_type",
  "name",
  "namespace",
  "encrypted_secret",
  "external_id",
  "created"
) VALUES (
  'my-uuid',
  'some-type',
  'name',
  'namespace',
  'encrypted',
  'external-id',
  1234
);
