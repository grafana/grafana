UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "active" }} = false
WHERE
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "owner_reference_api_group" }} = {{ .Arg .OwnerReferenceAPIGroup }} AND
  {{ .Ident "active" }} = true
;