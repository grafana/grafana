SELECT 
  p.id, p.action, p.scope, p.created, p.updated,
  r.name as role_name,
  COALESCE(u.uid, t.uid, br.role) as subject_uid,
  CASE WHEN u.uid IS NOT NULL THEN 'user' 
       WHEN t.uid IS NOT NULL THEN 'team'
       ELSE 'builtin_role' END as subject_type,
  COALESCE(u.is_service_account, {{ .Arg false }}) as is_service_account
FROM {{ .Ident .PermissionTable }} p
INNER JOIN {{ .Ident .RoleTable }} r ON p.role_id = r.id
LEFT JOIN {{ .Ident .UserRoleTable }} ur ON r.id = ur.role_id AND ur.org_id = r.org_id
LEFT JOIN {{ .Ident .UserTable }} u ON ur.user_id = u.id
LEFT JOIN {{ .Ident .TeamRoleTable }} tr ON r.id = tr.role_id AND tr.org_id = r.org_id
LEFT JOIN {{ .Ident .TeamTable }} t ON tr.team_id = t.id
LEFT JOIN {{ .Ident .BuiltinRoleTable }} br ON r.id = br.role_id
WHERE r.name LIKE {{ .Arg .ManagedRolePattern }}
{{ if .Query.ActionSets }}
AND p.action IN ({{ .ArgList .Query.ActionSets }})
{{ end }}
AND (u.uid IS NOT NULL OR t.uid IS NOT NULL OR br.role IS NOT NULL)
{{ if .Query.OrgID }}
AND COALESCE(ur.org_id, tr.org_id, r.org_id) = {{ .Arg .Query.OrgID }}
{{ end }}
{{ if eq (len .Query.Scopes) 1 }}
AND p.scope = {{ .Arg (index .Query.Scopes 0) }}
{{ else if gt (len .Query.Scopes) 1 }}
AND p.scope IN ({{ .ArgList .Query.Scopes }})
{{ end }}
ORDER BY p.scope
