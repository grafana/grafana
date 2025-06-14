SELECT r.version, r.org_id, r.id, r.uid, r.name, r.display_name, r.description, r.group_name, r.hidden, r.created, r.updated
  FROM {{ .Ident .RoleTable }} as r
 WHERE r.name LIKE {{ .Arg .FixedRolePattern }} AND r.org_id = 0
{{ if .Query.UID }}
   AND r.uid = {{ .Arg .Query.UID }}
{{ end }}
{{ if .Query.Pagination.Continue }}
   AND r.id >= {{ .Arg .Query.Pagination.Continue }}
{{ end }}
 ORDER BY r.id asc
 LIMIT {{ .Arg .Query.Pagination.Limit }}