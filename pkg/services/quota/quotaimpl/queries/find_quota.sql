SELECT id
FROM {{ .Ident .QuotaTable }}
WHERE target = {{ .Arg .Cmd.Target }}
{{ if .Cmd.UserID }}
  AND user_id = {{ .Arg .Cmd.UserID }}
{{ end }}
{{ if .Cmd.OrgID }}
  AND org_id = {{ .Arg .Cmd.OrgID }}
{{ end }}
