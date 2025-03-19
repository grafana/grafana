SELECT p.kind, p.attribute, p.identifier, p.scope FROM {{ .Ident .PermissionTable }} as p
LEFT JOIN {{ .Ident .BuiltinRoleTable }} as br ON p.role_id = br.role_id 
    AND (br.role = {{ .Arg .Query.Role }} AND (br.org_id = {{ .Arg .Query.OrgID }} OR br.org_id = 0))
    {{ if .Query.IsServerAdmin }}
    OR (br.role = 'Grafana Admin')
    {{ end }}
{{ if .Query.UserID }}
LEFT JOIN {{ .Ident .UserRoleTable }} as ur ON p.role_id = ur.role_id 
    AND ur.user_id = {{ .Arg .Query.UserID }} AND (ur.org_id = {{ .Arg .Query.OrgID }} OR ur.org_id = 0)
{{ end }}
{{ if .Query.TeamIDs }}
LEFT JOIN {{ .Ident .TeamRoleTable }} as tr ON p.role_id = tr.role_id 
    AND tr.team_id IN ({{ .ArgList .Query.TeamIDs }}) AND tr.org_id = {{ .Arg .Query.OrgID }}
{{ end }}
WHERE
  {{ if .Query.ActionSets }}
  p.action IN ({{ .ArgList .Query.ActionSets }}, {{ .Arg .Query.Action }})
  {{ else }}
  p.action = {{ .Arg .Query.Action }}
  {{ end }}
AND (br.role_id IS NOT NULL
  {{ if .Query.UserID }}
  OR ur.role_id IS NOT NULL
  {{ end }}
  {{ if .Query.TeamIDs }}
  OR tr.role_id IS NOT NULL
  {{ end }}
);