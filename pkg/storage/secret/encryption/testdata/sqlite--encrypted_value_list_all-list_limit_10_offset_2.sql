SELECT
  "namespace",
  "name",
  "version",
  "encrypted_data",
  "created",
  "updated"
FROM
  "secret_encrypted_value"
ORDER BY "created" ASC
LIMIT 10 OFFSET 2
;
