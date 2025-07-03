SELECT
  "uid",
  "namespace",
  "label",
  "provider",
  "encrypted_data",
  "active",
  "created",
  "updated"
FROM
  "secret_data_key"
WHERE "namespace" = 'ns' AND
  "uid" = 'abc123'
;
