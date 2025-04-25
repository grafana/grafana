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
  "type",
  "payload"
FROM
  "secret_keeper"
WHERE 1 = 1 AND
  "namespace" = 'ns' AND
  "name" = 'name'
FOR UPDATE
;
