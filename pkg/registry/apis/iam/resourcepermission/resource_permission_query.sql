SELECT 
	p.id, 
	p.action, 
	p.scope, 
	p.created, 
	p.updated,
	r.name as role_name, 
	r.uid as role_uid
FROM {{ .Ident .PermissionTable }} p
INNER JOIN {{ .Ident .RoleTable }} r ON p.role_id = r.id
WHERE p.scope LIKE 'dashboards:%'
ORDER BY p.id
{{ if .Query.Pagination.Limit }}
LIMIT {{ .Arg .Query.Pagination.Limit }}
{{ end }}
{{ if .Query.Pagination.Continue }}
OFFSET {{ .Arg .Query.Pagination.Continue }}
{{ end }} 