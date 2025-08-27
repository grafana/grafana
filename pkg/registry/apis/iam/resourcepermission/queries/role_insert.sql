INSERT INTO {{ .Ident .RoleTable }} (org_id, uid, name, created, updated)
VALUES (
    {{ .Arg .OrgID }},
    {{ .Arg .UID }},
    {{ .Arg .Name }},
    {{ .Arg .Now }},
    {{ .Arg .Now }}
)