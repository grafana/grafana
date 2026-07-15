SELECT id
FROM {{ .Ident .QuotaTable }}
WHERE target = {{ .Arg .Quota.Target }}
{{ if .Quota.UserId }}
  AND user_id = {{ .Arg .Quota.UserId }}
{{ end }}
{{ if .Quota.OrgId }}
  AND org_id = {{ .Arg .Quota.OrgId }}
{{ end }}
