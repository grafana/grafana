SELECT 
  p.id, p.action, p.scope, p.created, p.updated,
  COALESCE(u.uid, t.uid, br.role) as subject_uid,
  CASE WHEN u.uid IS NOT NULL THEN 'user' 
       WHEN t.uid IS NOT NULL THEN 'team'
       ELSE 'builtin_role' END as subject_type,
  COALESCE(u.is_service_account, 0) as is_service_account,
  r.name as role_name
FROM {{ .Ident .PermissionTable }} p
INNER JOIN {{ .Ident .RoleTable }} r ON p.role_id = r.id
LEFT JOIN user_role ur ON r.id = ur.role_id AND ur.org_id = r.org_id
LEFT JOIN {{ .Ident "user" }} u ON ur.user_id = u.id
LEFT JOIN team_role tr ON r.id = tr.role_id AND tr.org_id = r.org_id
LEFT JOIN team t ON tr.team_id = t.id
LEFT JOIN builtin_role br ON r.id = br.role_id
WHERE r.name LIKE 'managed:%'
{{ if .Query.ActionSets }}
AND p.action in ({{ .ArgList .Query.ActionSets }})
{{ end }}
{{ if .Query.Scope }}
AND p.scope = {{ .Arg .Query.Scope }}
{{ end }}
AND (u.uid IS NOT NULL OR t.uid IS NOT NULL OR br.role IS NOT NULL)
AND COALESCE(ur.org_id, tr.org_id, r.org_id) = {{ .Arg .Query.OrgID }}
ORDER BY p.id
{{ if .Query.Pagination.Limit }}
LIMIT {{ .Arg .Query.Pagination.Limit }}
{{ end }}
{{ if .Query.Pagination.Continue }}
OFFSET {{ .Arg .Query.Pagination.Continue }}
{{ end }} 