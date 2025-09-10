SELECT p.updated AS latest_update
FROM {{ .Ident .PermissionTable }} AS p
INNER JOIN {{ .Ident .RoleTable }} AS r ON p.role_id = r.id
WHERE r.name LIKE {{ .Arg .ManagedPattern }} 
    AND r.org_id = {{ .Arg .OrgID }}
    AND ( {{ range $index, $scopePattern := .ScopePatterns }}{{ if $index }} OR {{ end }} p.scope LIKE {{ $.Arg $scopePattern }}{{ end }} )
ORDER BY p.updated DESC
LIMIT 1;
