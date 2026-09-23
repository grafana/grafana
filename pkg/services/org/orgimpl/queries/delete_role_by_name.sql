DELETE FROM {{ .Ident .RoleTable }}
WHERE name = {{ .Arg .RoleName }}
