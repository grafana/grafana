SELECT
  {{ .Ident "name" }} 
FROM
  {{ .Ident "secret_secure_value" }}
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "active" }} = true AND
  {{ .Ident "owner_reference_api_version" }} IS NOT NULL AND {{ .Ident "owner_reference_api_version" }} != '' AND
  {{ .Ident "owner_reference_kind" }} IS NOT NULL AND {{ .Ident "owner_reference_kind" }} != '' AND
  {{ .Ident "owner_reference_name" }} IS NOT NULL AND {{ .Ident "owner_reference_name" }} != '' AND
  {{ .Ident "owner_reference_uid" }} IS NOT NULL AND {{ .Ident "owner_reference_uid" }} != '' AND
  {{ .Ident "owner_reference_api_version" }} = {{ .Arg .OwnerReferenceAPIVersion }} AND
  {{ .Ident "owner_reference_kind" }} = {{ .Arg .OwnerReferenceKind }} AND
  {{ .Ident "owner_reference_name" }} = {{ .Arg .OwnerReferenceName }} AND
  {{ .Ident "owner_reference_uid" }} = {{ .Arg .OwnerReferenceUID }}
;