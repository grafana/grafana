INSERT INTO {{ .Ident "serviceaccount_token" }} (
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
) VALUES (
  {{ .Arg .Row.ID }},
  {{ .Arg .Row.Namespace }},
  {{ .Arg .Row.Name }},
  {{ .Arg .Row.Key }},
  {{ .Arg .Row.Created }},
  {{ .Arg .Row.Updated }},
  NULL,
  {{ .Arg .Row.ServiceAccountName }},
  {{ .Arg .IsRevoked }},
  {{ if .Row.Expires }}{{ .Arg .Expires }}{{ else }}NULL{{ end }}
);
