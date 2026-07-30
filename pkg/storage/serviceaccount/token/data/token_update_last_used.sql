UPDATE {{ .Ident "serviceaccount_token" }}
SET {{ .Ident "last_used_at" }} = {{ .Arg .LastUsedAt }}
WHERE
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "id" }} = {{ .Arg .ID }}
;
