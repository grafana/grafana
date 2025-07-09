SELECT o.org_id, u.id, u.uid, u.login, u.email, u.name,
  u.created, u.updated, u.is_service_account, u.is_disabled, u.is_admin,
  u.email_verified, u.is_provisioned, u.last_seen_at
  FROM {{ .Ident .UserTable }} as u JOIN {{ .Ident .OrgUserTable }} as o ON u.id = o.user_id
 WHERE o.org_id = {{ .Arg .Query.OrgID }}
   AND NOT u.is_service_account
{{ if .Query.UID }}
   AND u.uid = {{ .Arg .Query.UID }}
{{ end }}
{{ if .Query.Pagination.Continue }}
   AND u.id >= {{ .Arg .Query.Pagination.Continue }}
{{ end }}
 ORDER BY u.id asc
 LIMIT {{ .Arg .Query.Pagination.Limit }}
