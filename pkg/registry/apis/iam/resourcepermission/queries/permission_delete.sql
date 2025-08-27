DELETE FROM {{ .Ident .PermissionTable }}
WHERE role_id = {{ .Arg .RoleID }} AND scope = {{ .Arg .Scope }};
