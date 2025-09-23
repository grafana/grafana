SELECT u.id, u.uid
FROM {{ .Ident .UserTable }} as u
{{ if .Query.UserUID }}
  WHERE u.uid = {{ .Arg .Query.UserUID }}
{{ else }}
  WHERE u.id = {{ .Arg .Query.UserID }}
{{ end }}
