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
  "status_phase",
  "status_message",
  "description",
  "keeper",
  "decrypters",
  "ref",
  "external_id"
FROM
  "secret_secure_value"
WHERE "namespace" = 'ns' AND
  "name" = 'name'
FOR UPDATE
;
