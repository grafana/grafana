SELECT
  "namespace",
  "name",
  "version",
  "encrypted_data",
  "data_key_id",
  "created",
  "updated"
FROM
  "secret_encrypted_value"
ORDER BY "created" ASC
;
