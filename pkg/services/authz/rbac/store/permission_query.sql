SELECT p.action, p.kind, p.attribute, p.identifier, p.scope FROM {{ .Ident .PermissionTable }} as p
WHERE p.action = {{ .Arg .Query.Action }} AND p.role_id IN (
  SELECT role_id FROM {{ .Ident .BuiltinRoleTable }} as br WHERE (br.role = {{ .Arg .Query.Role }} AND (br.org_id = {{ .Arg .Query.OrgID }} OR br.org_id = 0))
    {{ if .Query.IsServerAdmin }}
   OR (br.role = 'Grafana Admin')
    {{ end }}
    {{ if .Query.UserID }}
    UNION
  SELECT role_id FROM {{ .Ident .UserRoleTable }} as ur WHERE ur.user_id = {{ .Arg .Query.UserID }} AND (ur.org_id = {{ .Arg .Query.OrgID }} OR ur.org_id = 0)
    {{ end }}
    {{ if .Query.TeamIDs }}
    UNION
    SELECT role_id FROM {{ .Ident .TeamRoleTable }} as tr WHERE tr.team_id IN ({{ .ArgList .Query.TeamIDs }}) AND tr.org_id = {{ .Arg .Query.OrgID }}
  {{ end }}
)
