SELECT p.scope, MAX(p.id) AS id
FROM {{ .Ident .PermissionTable }} p
INNER JOIN {{ .Ident .RoleTable }} r ON p.role_id = r.id
WHERE r.name LIKE {{ .Arg .ManagedRolePattern }} 
    AND r.org_id = {{ .Arg .Query.OrgID }}
    AND p.id > {{ .Arg .Query.Pagination.Continue }}
GROUP BY p.scope
ORDER BY p.scope
LIMIT {{ .Arg .Query.Pagination.Limit }}