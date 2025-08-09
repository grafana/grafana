INSERT INTO {{ .Ident .PermissionTable }} (role_id, action, scope, created, updated, kind, attribute, identifier)
VALUES {{ range $index, $permission := .ResourcePermissions }}{{ if $index }},{{ end }}
    (
        {{ $.Arg $.RoleID }},
        {{ $.Arg $permission.Action }},
        {{ $.Arg $permission.Scope }},
        {{ $.Arg $.Now }},
        {{ $.Arg $.Now }},
        {{ $.Arg $permission.Kind }},
        {{ $.Arg $permission.Attribute }},
        {{ $.Arg $permission.Identifier }}
    ){{ end }}; 