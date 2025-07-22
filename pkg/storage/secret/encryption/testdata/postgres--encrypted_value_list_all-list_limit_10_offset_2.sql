SELECT
  "namespace",
  "name",
  "version",
  "encrypted_data",
  "created",
  "updated"
FROM
  "secret_encrypted_value"
ORDER BY "name" ASC
LIMIT 10 OFFSET 2
;
