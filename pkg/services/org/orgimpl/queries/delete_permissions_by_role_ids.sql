DELETE FROM {{ .Ident .PermissionTable }}
WHERE role_id IN ({{ .ArgList .RoleIDs }})
