SELECT COUNT(*) AS count
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
