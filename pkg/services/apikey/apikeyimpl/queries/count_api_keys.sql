SELECT COUNT(*) AS count
FROM {{ .Ident .APIKeyTable }}
{{- if .OrgID }}
WHERE org_id = {{ .Arg .OrgID }}
{{- end }}
