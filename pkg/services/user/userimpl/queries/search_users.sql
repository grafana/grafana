SELECT
  u.id,
  u.uid,
  u.email,
  u.name,
  u.login,
  u.is_admin,
  u.is_disabled,
  u.last_seen_at,
  user_auth.auth_module,
  u.is_provisioned,
  u.created
FROM {{ .Ident .UserTable }} AS u
LEFT JOIN {{ .Ident .UserAuthTable }} AS user_auth ON user_auth.id = (
  SELECT id
  FROM {{ .Ident .UserAuthTable }} AS user_auth
  WHERE user_auth.user_id = u.id
  ORDER BY user_auth.created DESC
  LIMIT 1
)
{{ range .Joins -}}
{{ .Operator }} JOIN {{ $.Ident .Table }} AS {{ $.Ident .Alias }} ON {{ .Condition }}
{{ end -}}
WHERE u.is_service_account = {{ .Arg .IsServiceAccount }}
{{ if gt .OrgID 0 -}}
  AND u.org_id = {{ .Arg .OrgID }}
{{ end -}}
{{ if .AccessUserIDs -}}
  AND u.id IN ({{ .ArgList .AccessUserIDs }})
{{ else if not .AccessAll -}}
  AND 1 = 0
{{ end -}}
{{ if .QueryPattern -}}
  AND (
    u.email {{ if eq .DialectName "postgres" }}ILIKE{{ else }}LIKE{{ end }} {{ .Arg .QueryPattern }}
    OR u.name {{ if eq .DialectName "postgres" }}ILIKE{{ else }}LIKE{{ end }} {{ .Arg .QueryPattern }}
    OR u.login {{ if eq .DialectName "postgres" }}ILIKE{{ else }}LIKE{{ end }} {{ .Arg .QueryPattern }}
  )
{{ end -}}
{{ if .IsDisabled -}}
  AND u.is_disabled = {{ .Arg .IsDisabledValue }}
{{ end -}}
{{ if .AuthModule -}}
  AND user_auth.auth_module = {{ .Arg .AuthModule }}
{{ end -}}
{{ range .Filters -}}
{{ if eq .Kind "in" -}}
{{ if .Values -}}
  AND {{ $.Ident .Condition }} IN ({{ $.ArgList .Values }})
{{ else -}}
  AND 0 = 1
{{ end -}}
{{ else -}}
  AND {{ range .Parts }}{{ .SQL }}{{ if .HasValue }}{{ $.Arg .Value }}{{ end }}{{ end }}
{{ end -}}
{{ end -}}
{{ if or .Sorts .UseDefaultSort -}}
ORDER BY
{{ if .Sorts -}}
  {{ range $index, $sort := .Sorts }}{{ if $index }}, {{ end }}{{ $sort }}{{ end }}
{{ else if .UseDefaultSort -}}
  u.login ASC, u.email ASC
{{ end -}}
{{ end -}}
{{ if gt .Limit 0 -}}
LIMIT {{ .Arg .Limit }}{{ if gt .Offset 0 }} OFFSET {{ .Arg .Offset }}{{ end }}
{{ end -}}
