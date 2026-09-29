SELECT id
FROM {{ .Ident .RoleTable }}
WHERE name = {{ .Arg .RoleName }}
