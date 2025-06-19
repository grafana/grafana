SELECT
  "request_id",
  "id",
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
WHERE 
  "id" IN (1, 2, 3)
ORDER BY
  "id" ASC
;
