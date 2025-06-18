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
WHERE 
  "uid" IN ('a', 'b', 'c')
ORDER BY
  "created" ASC
;
