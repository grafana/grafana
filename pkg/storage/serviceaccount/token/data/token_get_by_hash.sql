SELECT
  {{ .Ident "id" }},
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "key" }},
  {{ .Ident "created" }},
  {{ .Ident "updated" }},
  {{ .Ident "last_used_at" }},
  {{ .Ident "service_account_name" }},
  {{ .Ident "is_revoked" }},
  {{ .Ident "expires" }}
FROM {{ .Ident "serviceaccount_token" }}
WHERE {{ .Ident "key" }} = {{ .Arg .Hash }}
;
