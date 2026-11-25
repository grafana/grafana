SELECT p.action, p.scope, assignments.team_id
FROM {{ .Ident .PermissionTable }} AS p
INNER JOIN {{ .Ident .RoleTable }} AS r ON r.id = p.role_id
INNER JOIN (
  SELECT tr.role_id, tr.team_id FROM {{ .Ident .TeamRoleTable }} AS tr
  WHERE tr.team_id IN ({{ .ArgList .Query.TeamIDs }}) AND tr.org_id = {{ .Arg .Query.OrgID }}
) AS assignments ON r.id = assignments.role_id
WHERE 1 = 1
{{ template "legacy_permission_filters" . }}
