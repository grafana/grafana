-- No need to handle the provisioned permissions (what comes from fixed or custom roles)
-- We only care about managed roles
-- This query retrieves permissions for users, teams, basic roles that are associated with managed roles
-- and the permissions that are associated with those roles.
-- The query is designed to return permissions for dashboards, but we need to replace with ArgList Query.Actions
-- The query can also be improved to filter by scope (Arg Query.UID) for the get case.

-- select br.role as basic, u.uid as user, t.uid as team r.name, p.action, p.scope from role as r
-- inner join permission as p on r.id = p.role_id
-- left join user_role as ur on ur.role_id = r.id
-- left join user as u on ur.user_id = u.id
-- left join team_role as tr on tr.role_id = r.id
-- left join team as t on tr.team_id = t.id
-- left join builtin_role as br on br.role_id = r.id
-- where r.name like "managed:%" and p.action IN ("dashboards:admin", "dashboards:edit", "dashboards:view")
--   and r.org_id = Arg Query.OrgID; 

SELECT 
  p.id, p.action, p.scope, p.created, p.updated,
  COALESCE(u.uid, t.uid, br.role) as subject_uid,
  CASE WHEN u.uid IS NOT NULL THEN 'user' 
       WHEN t.uid IS NOT NULL THEN 'team'
       ELSE 'builtin_role' END as subject_type,
  COALESCE(u.is_service_account, 0) as is_service_account
FROM {{ .Ident .PermissionTable }} p
INNER JOIN {{ .Ident .RoleTable }} r ON p.role_id = r.id
LEFT JOIN user_role ur ON r.id = ur.role_id AND ur.org_id = r.org_id
LEFT JOIN {{ .Ident "user" }} u ON ur.user_id = u.id
LEFT JOIN team_role tr ON r.id = tr.role_id AND tr.org_id = r.org_id
LEFT JOIN team t ON tr.team_id = t.id
LEFT JOIN builtin_role br ON r.id = br.role_id
WHERE r.name LIKE 'managed:%'
{{ if .Query.Actions }}
AND p.action LIKE {{ .Arg .Query.Actions }}+":%"
{{ end }}
AND (u.uid IS NOT NULL OR t.uid IS NOT NULL OR br.role IS NOT NULL)
{{ if .Query.OrgID }}
AND COALESCE(ur.org_id, tr.org_id, r.org_id) = {{ .Arg .Query.OrgID }}
{{ end }}
{{ if .Query.UID }}
AND (u.uid = {{ .Arg .Query.UID }} OR t.uid = {{ .Arg .Query.UID }} OR br.role = {{ .Arg .Query.UID }})
{{ end }}
ORDER BY p.id
{{ if .Query.Pagination.Limit }}
LIMIT {{ .Arg .Query.Pagination.Limit }}
{{ end }}
{{ if .Query.Pagination.Continue }}
OFFSET {{ .Arg .Query.Pagination.Continue }}
{{ end }} 