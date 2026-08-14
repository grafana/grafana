INSERT INTO {{ .Ident .TokenTable }}
  (org_id, name, {{ .Ident "key" }}, role, service_account_id, created, updated, expires, is_revoked)
VALUES
  ({{ .Arg .Command.OrgID }},
   {{ .Arg .Command.Name }},
   {{ .Arg .Command.HashedKey }},
   {{ .Arg .Command.Role }},
   {{ .Arg .Command.ServiceAccountID }},
   {{ .Arg .Command.Created }},
   {{ .Arg .Command.Updated }},
   {{ if .Command.Expires }}{{ .Arg (.ExpiresVal) }}{{ else }}NULL{{ end }},
   {{ .Arg .Command.IsRevoked }})
