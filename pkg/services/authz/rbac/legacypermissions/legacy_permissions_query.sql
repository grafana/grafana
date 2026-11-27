SELECT p.action, p.scope
FROM {{ .Ident .PermissionTable }} AS p
INNER JOIN {{ .Ident .RoleTable }} AS r ON r.id = p.role_id
INNER JOIN (
  {{ if gt .Query.UserID 0 }}
  SELECT ur.role_id FROM {{ .Ident .UserRoleTable }} AS ur
  WHERE ur.user_id = {{ .Arg .Query.UserID }} AND (ur.org_id = {{ .Arg .Query.OrgID }} OR ur.org_id = 0)
  {{ end }}
  {{ if .Query.TeamIDs }}
  {{ if gt .Query.UserID 0 }}UNION{{ end }}
  SELECT tr.role_id FROM {{ .Ident .TeamRoleTable }} AS tr
  WHERE tr.team_id IN ({{ .ArgList .Query.TeamIDs }}) AND tr.org_id = {{ .Arg .Query.OrgID }}
  {{ end }}
  {{ if .Query.Roles }}
  {{ if or (gt .Query.UserID 0) .Query.TeamIDs }}UNION{{ end }}
  SELECT br.role_id FROM {{ .Ident .BuiltinRoleTable }} AS br
  WHERE br.role IN ({{ .ArgList .Query.Roles }}) AND (br.org_id = {{ .Arg .Query.OrgID }} OR br.org_id = 0)
  {{ end }}
) AS assignments ON r.id = assignments.role_id
WHERE 1 = 1
{{ template "legacy_permission_filters" . }}
{{ if .Actions }}AND p.action IN ({{ .ArgList .Actions }}){{ end }}

{{ define "legacy_permission_filters" }}
{{ if .Query.RolePrefixes }}
AND ({{ range $i, $prefix := .Query.RolePrefixes }}{{ if $i }} OR {{ end }}r.name LIKE {{ $.Arg (printf "%s%%" $prefix) }}{{ end }})
{{ end }}
{{ if .Query.ExcludeRedundantManagedPermissions }}
AND NOT (
  r.name LIKE 'managed:%'
  AND p.kind IN ('dashboards', 'folders')
  AND p.action NOT IN (
    'dashboards:view', 'dashboards:edit', 'dashboards:admin',
    'folders:view', 'folders:edit', 'folders:admin'
  )
)
{{ end }}
{{ end }}
