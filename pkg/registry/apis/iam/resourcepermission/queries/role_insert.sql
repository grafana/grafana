INSERT INTO {{ .Ident .RoleTable }} (version, org_id, uid, name, created, updated)
VALUES (
    0,
    {{ .Arg .OrgID }},
    {{ .Arg .UID }},
    {{ .Arg .Name }},
    {{ .Arg .Now }},
    {{ .Arg .Now }}
)