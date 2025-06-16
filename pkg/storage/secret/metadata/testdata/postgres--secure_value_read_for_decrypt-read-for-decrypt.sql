SELECT
  "keeper",
  "decrypters",
  "ref",
  "external_id"
FROM
  "secret_secure_value"
WHERE "namespace" = 'ns' AND
  "name" = 'name'
;
