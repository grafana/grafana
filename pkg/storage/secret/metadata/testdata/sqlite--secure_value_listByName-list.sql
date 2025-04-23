SELECT
  "name",
  "keeper"
FROM
  "secret_secure_value"
WHERE 1 = 1 AND
  "namespace" = 'ns' AND
  "name" IN ('a', 'b')
;
