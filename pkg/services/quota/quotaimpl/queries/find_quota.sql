SELECT id
FROM {{ .Ident .QuotaTable }}
WHERE target = {{ .Arg .Target }}
{{ if .UserID }}
  AND user_id = {{ .Arg .UserID }}
{{ end }}
{{ if .OrgID }}
  AND org_id = {{ .Arg .OrgID }}
{{ end }}
