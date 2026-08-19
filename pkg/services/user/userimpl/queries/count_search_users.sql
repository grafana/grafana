{{/* search_users_where is defined in search_users.sql. */}}
SELECT COUNT(*) AS count
FROM {{ .Ident .UserTable }} AS u
{{ if .IncludeAuthJoin -}}
LEFT JOIN {{ .Ident .UserAuthTable }} AS user_auth ON user_auth.id = (
  SELECT id
  FROM {{ .Ident .UserAuthTable }} AS user_auth
  WHERE user_auth.user_id = u.id
  ORDER BY user_auth.created DESC
  LIMIT 1
)
{{ end -}}
{{ range .Joins -}}
{{ .Operator }} JOIN {{ $.Ident .Table }} AS {{ $.Ident .Alias }} ON {{ .Condition }}
{{ end -}}
{{ template "search_users_where" . }}
