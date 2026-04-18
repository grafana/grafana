SELECT p.scope
FROM {{ .Ident .PermissionTable }} AS p
INNER JOIN {{ .Ident .RoleTable }} AS r ON p.role_id = r.id
WHERE r.name LIKE {{ .Arg .ManagedRolePattern }} 
    AND r.org_id = {{ .Arg .Query.OrgID }}
    AND ( {{ range $index, $scopePattern := .Query.ScopePatterns }}{{ if $index }} OR {{ end }} p.scope LIKE {{ $.Arg $scopePattern }}{{ end }} )
GROUP BY p.scope
ORDER BY p.scope
LIMIT {{ .Arg .Query.Pagination.Limit }}
OFFSET {{ .Arg .Query.Pagination.Continue }}
