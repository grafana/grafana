SELECT
  "namespace",
  "name",
  "version",
  "encrypted_data",
  "created",
  "updated"
FROM
  "secret_encrypted_value"
WHERE "created" <= 1234
ORDER BY "created" ASC
;
