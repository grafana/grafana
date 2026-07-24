SELECT
  "name",
  "keeper"
FROM
  "secret_secure_value"
WHERE
  "namespace" = 'ns' AND
  "name" IN ('a', 'b') AND
  "active" = true
;
