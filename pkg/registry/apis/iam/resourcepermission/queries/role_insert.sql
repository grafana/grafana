INSERT INTO {{ .Ident .RoleTable }} (org_id, uid, name, created, updated)
VALUES (
    {{ .Arg .Role.OrgID }},
    {{ .Arg .Role.UID }},
    {{ .Arg .Role.Name }},
    {{ .Arg .Now }},
    {{ .Arg .Now }}
)