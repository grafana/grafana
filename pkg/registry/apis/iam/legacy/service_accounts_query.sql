SELECT
  u.id,
  u.uid,
  u.name,
  u.is_disabled,
  o.role,
  u.created,
  u.updated
  FROM {{ .Ident .UserTable }} as u JOIN {{ .Ident .OrgUserTable }} as o ON u.id = o.user_id
 WHERE o.org_id = {{ .Arg .Query.OrgID }}
   AND u.is_service_account
{{ if .Query.UID }}
   AND u.uid = {{ .Arg .Query.UID }}
{{ end }}
{{ if .Query.Pagination.Continue }}
   AND u.id >= {{ .Arg .Query.Pagination.Continue }}
{{ end }}
 ORDER BY u.id asc
 LIMIT {{ .Arg .Query.Pagination.Limit }}
