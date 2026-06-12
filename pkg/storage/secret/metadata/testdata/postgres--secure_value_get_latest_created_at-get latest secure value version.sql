SELECT
  "created",
  "created_by",
  "active",
  "namespace",
  "name"
FROM
  "secret_secure_value"
WHERE
  "namespace" = 'ns' AND
  "name" = 'name' AND
  "active" = TRUE
LIMIT 1
;
