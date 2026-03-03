INSERT INTO "secret_secure_value_gc_dlq" (
  "guid",
  "name",
  "namespace",
  "annotations",
  "labels",
  "created",
  "created_by",
  "updated",
  "updated_by",
  "active",
  "version",
  "description",
  "keeper",
  "decrypters",
  "ref",
  "owner_reference_api_group",
  "owner_reference_api_version",
  "owner_reference_kind",
  "owner_reference_name",
  "external_id"
) 
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
  "active",
  "version",
  "description",
  "keeper",
  "decrypters",
  "ref",
  "owner_reference_api_group",
  "owner_reference_api_version",
  "owner_reference_kind",
  "owner_reference_name",
  "external_id"
FROM "secret_secure_value"
WHERE 
  "guid" IN ('1', '2') AND
  NOT EXISTS (
    SELECT 1 FROM "secret_secure_value_gc_dlq"
    WHERE "secret_secure_value"."guid" = "secret_secure_value_gc_dlq"."guid"
    LIMIT 1
  )
