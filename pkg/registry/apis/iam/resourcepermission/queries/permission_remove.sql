DELETE FROM {{ .Ident .PermissionTable }} AS p
WHERE p.scope = {{ .Arg .Scope }}
AND p.role_id = (
    SELECT r.id
    FROM {{ .Ident .RoleTable }} AS r
    WHERE r.org_id = {{ .Arg .OrgID }}
    AND r.name = {{ .Arg .RoleName }}
    LIMIT 1
)
