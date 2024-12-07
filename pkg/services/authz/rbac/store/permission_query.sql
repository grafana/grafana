SELECT p.action, p.kind, p.attribute, p.identifier, p.scope from {{ .Ident .PermissionTable }} as p
where p.action = {{ .Arg .Query.Action }} AND p.role_id in (
  SELECT role_id from {{ .Ident .UserRoleTable }} as ur where ur.user_id = {{ .Arg .Query.UserID }} AND (ur.org_id = {{ .Arg .Query.OrgID }} OR ur.org_id = 0)
  {{ if .Query.TeamIDs }}
    UNION
    SELECT role_id from {{ .Ident .TeamRoleTable }} as tr where tr.team_id IN ({{ .ArgList .Query.TeamIDs }}) AND tr.org_id = {{ .Arg .Query.OrgID }}
  {{ end }}
  UNION ALL
  SELECT role_id from {{ .Ident .BuiltinRoleTable }} as br where (br.role = {{ .Arg .Query.Role }} AND (br.org_id = {{ .Arg .Query.OrgID }} OR br.org_id = 0))
  {{ if .Query.IsServerAdmin }}
    OR (br.role = 'Grafana Admin')
  {{ end }}
)
