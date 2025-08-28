INSERT INTO {{ .Ident .AssignmentTable }} (org_id, {{ .Ident .AssignmentColumn }}, role_id, created{{ if eq .AssignmentColumn "role" }}, updated{{ end }})
VALUES (
    {{ .Arg .OrgID }},
    {{ .Arg .AssigneeID }},
    {{ .Arg .RoleID }},
    {{ .Arg .Now }}{{ if eq .AssignmentColumn "role" }},
    {{ .Arg .Now }}{{ end }}
)