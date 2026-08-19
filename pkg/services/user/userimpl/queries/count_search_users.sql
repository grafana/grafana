{{/* SQL partials are defined in search_users.sql. */}}
SELECT COUNT(*) AS count
FROM {{ .Ident .UserTable }} AS u
{{ if .AuthModule -}}
{{ template "latest_user_auth_join" . }}
{{ end -}}
{{ range .Joins -}}
{{ .Operator }} JOIN {{ $.Ident .Table }} AS {{ $.Ident .Alias }} ON {{ .Condition }}
{{ end -}}
{{ template "search_users_where" . }}
