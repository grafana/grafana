SELECT
  "request_id",
  "uid",
  "message_type",
  "name",
  "namespace",
  "encrypted_secret",
  "keeper_name",
  "external_id",
  "receive_count",
  "created"
FROM
  "secret_secure_value_outbox"
ORDER BY
  "created" ASC
LIMIT
  10
;
