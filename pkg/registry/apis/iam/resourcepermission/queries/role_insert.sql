INSERT INTO {{ .Ident .RoleTable }} (version, org_id, uid, name, created, updated)
VALUES (
    0,
    {{ .Arg .OrgID }},
    {{ .Arg .UID }},
    {{ .Arg .Name }},
    {{ .Arg .Now }},
    {{ .Arg .Now }}
){{ if eq .DialectName "mysql" }} ON DUPLICATE KEY UPDATE uid = IF(org_id = VALUES(org_id) AND name = VALUES(name), uid, NULL){{ else if or (eq .DialectName "postgres") (eq .DialectName "sqlite") }} ON CONFLICT (org_id, name) DO NOTHING{{ end }}
