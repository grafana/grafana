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
  "active",
  "version",
  "owner_reference_api_group",
  "owner_reference_api_version",
  "owner_reference_kind",
  "owner_reference_name"
FROM
  "secret_secure_value"
WHERE
  "namespace" = 'ns' AND
  "name" IN ('first', 'second', 'third') AND
  "active" = true
;
