INSERT INTO {{ .Ident "secret_secure_value_gc_dlq" }} (
  {{ .Ident "guid" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
  {{ .Ident "annotations" }},
  {{ .Ident "labels" }},
  {{ .Ident "created" }},
  {{ .Ident "created_by" }},
  {{ .Ident "updated" }},
  {{ .Ident "updated_by" }},
  {{ .Ident "active" }},
  {{ .Ident "version" }},
  {{ .Ident "description" }},
  {{ .Ident "keeper" }},
  {{ .Ident "decrypters" }},
  {{ .Ident "ref" }},
  {{ .Ident "owner_reference_api_group" }},
  {{ .Ident "owner_reference_api_version" }},
  {{ .Ident "owner_reference_kind" }},
  {{ .Ident "owner_reference_name" }},
  {{ .Ident "external_id" }}
) 
SELECT 
  {{ .Ident "guid" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
  {{ .Ident "annotations" }},
  {{ .Ident "labels" }},
  {{ .Ident "created" }},
  {{ .Ident "created_by" }},
  {{ .Ident "updated" }},
  {{ .Ident "updated_by" }},
  {{ .Ident "active" }},
  {{ .Ident "version" }},
  {{ .Ident "description" }},
  {{ .Ident "keeper" }},
  {{ .Ident "decrypters" }},
  {{ .Ident "ref" }},
  {{ .Ident "owner_reference_api_group" }},
  {{ .Ident "owner_reference_api_version" }},
  {{ .Ident "owner_reference_kind" }},
  {{ .Ident "owner_reference_name" }},
  {{ .Ident "external_id" }}
FROM {{ .Ident "secret_secure_value" }}
WHERE 
  {{ .Ident "guid" }} IN ({{ .ArgList .SecureValueIDs }}) AND
  NOT EXISTS (
    SELECT 1 FROM {{ .Ident "secret_secure_value_gc_dlq" }}
    WHERE {{ .Ident "secret_secure_value.guid" }} = {{ .Ident "secret_secure_value_gc_dlq.guid" }}
    LIMIT 1
  )

