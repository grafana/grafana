SELECT
  "name"
FROM
  "secret_keeper"
WHERE 1 = 1 AND
  "namespace" = 'ns' AND
  "name" IN ('a', 'b')
;
