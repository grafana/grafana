SELECT r.version, r.org_id, r.id, r.uid, r.name, r.display_name, r.description, r.group, r.hidden, r.created_at, r.updated_at
  FROM {{ .Ident .RoleTable }} as r
 WHERE r.org_id = {{ .Arg .Query.OrgID }}
{{ if .Query.UID }}
   AND r.uid = {{ .Arg .Query.UID }}
{{ end }}
{{ if .Query.Pagination.Continue }}
   AND r.id >= {{ .Arg .Query.Pagination.Continue }}
{{ end }}
 ORDER BY r.id asc
 LIMIT {{ .Arg .Query.Pagination.Limit }}
