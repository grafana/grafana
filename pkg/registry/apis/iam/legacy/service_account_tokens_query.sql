SELECT
  t.id,
  t.name,
  t.is_revoked,
  t.last_used_at,
  t.expires,
  t.created,
  t.updated
  FROM {{ .Ident .TokenTable }} as t
  INNER JOIN {{ .Ident .UserTable }} as u ON t.service_account_id = u.id
  INNER JOIN {{ .Ident .OrgUserTable }} as o ON u.id = o.user_id
WHERE o.org_id = {{ .Arg .Query.OrgID }}
   AND u.is_service_account
   AND u.uid = {{ .Arg .Query.UID }}
{{ if .Query.Pagination.Continue }}
   AND t.id >= {{ .Arg .Query.Pagination.Continue }}
{{ end }}
 ORDER BY t.id asc
 LIMIT {{ .Arg .Query.Pagination.Limit }}
