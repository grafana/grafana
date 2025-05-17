SELECT
  "uid",
  "namespace",
  "encrypted_data",
  "created",
  "updated"
FROM
  "secret_encrypted_value"
WHERE "namespace" = 'ns' AND
  "uid" = 'abc123'
;
