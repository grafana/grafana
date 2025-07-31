SELECT
  "name"
FROM
  "secret_keeper"
WHERE "namespace" = 'ns' AND
  "name" IN ('a', 'b')
;
