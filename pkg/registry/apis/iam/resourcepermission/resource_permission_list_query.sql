SELECT DISTINCT
  p.scope,
  MIN(p.created) as created
FROM {{ .Ident .PermissionTable }} p
INNER JOIN {{ .Ident .RoleTable }} r ON p.role_id = r.id
LEFT JOIN {{ .Ident .UserRoleTable }} ur ON r.id = ur.role_id AND ur.org_id = r.org_id
LEFT JOIN {{ .Ident .UserTable }} u ON ur.user_id = u.id
LEFT JOIN {{ .Ident .TeamRoleTable }} tr ON r.id = tr.role_id AND tr.org_id = r.org_id
LEFT JOIN {{ .Ident .TeamTable }} t ON tr.team_id = t.id
LEFT JOIN {{ .Ident .BuiltinRoleTable }} br ON r.id = br.role_id
WHERE r.name LIKE {{ .Arg .ManagedRolePrefix }}
{{ if .Query.ActionSets }}
AND p.action IN ({{ .ArgList .Query.ActionSets }})
{{ end }}
AND (u.uid IS NOT NULL OR t.uid IS NOT NULL OR br.role IS NOT NULL)
{{ if .Query.OrgID }}
AND COALESCE(ur.org_id, tr.org_id, r.org_id) = {{ .Arg .Query.OrgID }}
{{ end }}
{{ if .Query.Scope }}
AND p.scope LIKE {{ .Arg .Query.Scope }}
{{ end }}
AND p.scope IS NOT NULL 
AND p.scope != ''
AND (p.scope LIKE 'dashboards:uid:%' OR p.scope LIKE 'folders:uid:%')
GROUP BY p.scope
ORDER BY p.scope
{{ if .Query.Pagination.Limit }}
LIMIT {{ .Arg .Query.Pagination.Limit }}
{{ end }}
{{ if .Query.Pagination.Continue }}
OFFSET {{ .Arg .Query.Pagination.Continue }}
{{ end }}
