SELECT
  "guid",
  "name",
  "namespace",
  "annotations",
  "labels",
  "created",
  "created_by",
  "updated",
  "updated_by",
  "description",
  "keeper",
  "decrypters",
  "ref",
  "external_id",
  "version",
  "active"
FROM
  "secret_secure_value"
WHERE 
  "namespace" = 'ns' AND
  "active" = true
ORDER BY "updated" DESC
;
