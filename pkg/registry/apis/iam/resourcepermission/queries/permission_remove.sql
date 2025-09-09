DELETE p FROM {{ .Ident .PermissionTable }} AS p
WHERE p.id = {{ .Arg .PermissionID }}
