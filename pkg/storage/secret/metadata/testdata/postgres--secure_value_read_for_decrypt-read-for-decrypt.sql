SELECT
  "keeper",
  "decrypters",
  "ref",
  "external_id",
  "active"
FROM
  "secret_secure_value"
WHERE 
  "namespace" = 'ns' AND
  "name" = 'name' AND
  "active" = true
;
