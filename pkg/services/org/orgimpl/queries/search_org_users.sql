SELECT
  org_user.org_id,
  org_user.user_id,
  u.email,
  u.uid,
  u.name,
  u.login,
  org_user.role,
  u.last_seen_at,
  u.created,
  u.updated,
  u.is_disabled,
  u.is_provisioned
FROM {{ .Ident .OrgUserTable }} AS org_user
INNER JOIN {{ .Ident .UserTable }} AS u ON org_user.user_id = u.id
WHERE org_user.org_id = {{ .Arg .OrgID }}
{{ if .FilterByUserID -}}
  AND org_user.user_id = {{ .Arg .UserID }}
{{ end -}}
  AND u.is_service_account = {{ .Arg .IsServiceAccount }}
{{ if .AccessUserIDs -}}
  AND org_user.user_id IN ({{ .ArgList .AccessUserIDs }})
{{ else if not .AccessAll -}}
  AND 1 = 0
{{ end -}}
{{ if .HiddenUserLogins -}}
  AND u.login NOT IN ({{ .ArgList .HiddenUserLogins }})
{{ end -}}
{{ if .QueryPattern -}}
  AND (
    u.email {{ if eq .DialectName "postgres" }}ILIKE{{ else }}LIKE{{ end }} {{ .Arg .QueryPattern }}
    OR u.name {{ if eq .DialectName "postgres" }}ILIKE{{ else }}LIKE{{ end }} {{ .Arg .QueryPattern }}
    OR u.login {{ if eq .DialectName "postgres" }}ILIKE{{ else }}LIKE{{ end }} {{ .Arg .QueryPattern }}
  )
{{ end -}}
ORDER BY
{{ if .Sorts -}}
  {{ range $index, $sort := .Sorts }}{{ if $index }}, {{ end }}{{ $sort }}{{ end }}
{{ else -}}
  u.login ASC, u.email ASC
{{ end -}}
{{ if .Limit -}}
LIMIT {{ .Arg .Limit }} OFFSET {{ .Arg .Offset }}
{{ end -}}
