DELETE FROM {{ .Ident .PermissionTable }}
WHERE scope = {{ .Arg .Scope }}
