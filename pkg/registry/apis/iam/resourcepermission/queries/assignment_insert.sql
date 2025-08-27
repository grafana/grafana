INSERT INTO {{ .Ident .AssignmentTable }} (org_id, {{ .Ident .EntityColumn }}, role_id, created, updated)
VALUES (
    {{ .Arg .OrgID }},
    {{ .Arg .AssigneeID }},
    {{ .Arg .RoleID }},
    {{ .Arg .Now }},
    {{ .Arg .Now }}
)