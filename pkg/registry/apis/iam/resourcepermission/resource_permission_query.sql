SELECT 
	p.id, p.action, p.scope, p.created, p.updated,
	COALESCE(u.uid, t.uid) as subject_uid,
	CASE WHEN u.uid IS NOT NULL THEN 'user' ELSE 'team' END as subject_type,
	COALESCE(u.is_service_account, 0) as is_service_account
FROM {{ .Ident .PermissionTable }} p
INNER JOIN {{ .Ident .RoleTable }} r ON p.role_id = r.id
LEFT JOIN user_role ur ON r.id = ur.role_id AND ur.org_id = r.org_id
LEFT JOIN {{ .Ident "user" }} u ON ur.user_id = u.id
LEFT JOIN team_role tr ON r.id = tr.role_id AND tr.org_id = r.org_id
LEFT JOIN team t ON tr.team_id = t.id
WHERE p.scope LIKE 'dashboards:%'
AND (u.uid IS NOT NULL OR t.uid IS NOT NULL)
{{ if .Query.OrgID }}
AND COALESCE(ur.org_id, tr.org_id) = {{ .Arg .Query.OrgID }}
{{ end }}
{{ if .Query.UID }}
AND COALESCE(u.uid, t.uid) = {{ .Arg .Query.UID }}
{{ end }}
ORDER BY p.id
{{ if .Query.Pagination.Limit }}
LIMIT {{ .Arg .Query.Pagination.Limit }}
{{ end }}
{{ if .Query.Pagination.Continue }}
OFFSET {{ .Arg .Query.Pagination.Continue }}
{{ end }} 