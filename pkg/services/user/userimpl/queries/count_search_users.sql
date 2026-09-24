{{/* SQL partials are defined in search_users.sql. */}}
SELECT COUNT(*) AS count
FROM {{ .Ident .UserTable }} AS u
{{ if .AuthModule -}}
{{ template "latest_user_auth_join" . }}
{{ end -}}
{{ template "search_users_joins" . }}
{{ template "search_users_where" . }}
