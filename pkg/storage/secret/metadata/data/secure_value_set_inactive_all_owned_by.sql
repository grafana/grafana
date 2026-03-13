UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "active" }} = false
WHERE
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "owner_reference_api_group" }} = {{ .Arg .OwnerReferenceAPIGroup }} AND
  {{ .Ident "owner_reference_api_version" }} = {{ .Arg .OwnerReferenceAPIVersion }} AND
  {{ .Ident "owner_reference_kind" }} = {{ .Arg .OwnerReferenceKind }} AND
  {{ .Ident "owner_reference_name" }} = {{ .Arg .OwnerReferenceName }} AND
  {{ .Ident "active" }} = true
;