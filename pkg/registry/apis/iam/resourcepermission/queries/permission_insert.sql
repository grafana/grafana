INSERT INTO {{ .Ident .PermissionTable }} (role_id, action, scope, created, updated, kind, attribute, identifier)
VALUES (
    {{ .Arg $.RoleID }},
    {{ .Arg $.Permission.Action }},
    {{ .Arg $.Permission.Scope }},
    {{ .Arg $.Now }},
    {{ .Arg $.Now }},
    {{ .Arg $.Permission.Kind }},
    {{ .Arg $.Permission.Attribute }},
    {{ .Arg $.Permission.Identifier }}
)
