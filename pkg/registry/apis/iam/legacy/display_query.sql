SELECT o.org_id, u.id, u.uid, u.login, u.email, u.name, 
  u.created, u.updated, u.is_service_account, u.is_disabled, u.is_admin,
  u.email_verified, u.is_provisioned, u.last_seen_at
  FROM {{ .Ident .UserTable }} as u JOIN {{ .Ident .OrgUserTable }} as o ON u.id = o.user_id
 WHERE o.org_id = {{ .Arg .Query.OrgID }} AND ( 1=2
{{ if .Query.UIDs }}
   OR uid IN ({{ .ArgList .Query.UIDs }})
{{ end }}
{{ if .Query.IDs }}
   OR u.id IN ({{ .ArgList .Query.IDs }})
{{ end }}
 )
 ORDER BY u.id asc
 LIMIT 500