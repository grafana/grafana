SELECT org_user.org_id, u.id, u.uid, u.login, u.email, u.name, 
  u.created, u.updated, u.is_service_account, u.is_disabled, u.is_admin
  FROM {{ .Ident "user" }} as u JOIN org_user ON u.id = org_user.user_id
 WHERE org_user.org_id = {{ .Arg .Query.OrgID }} AND ( 1=2
{{ if .Query.UIDs }}
   OR uid IN ({{ .ArgList .Query.UIDs }})
{{ end }}
{{ if .Query.IDs }}
   OR u.id IN ({{ .ArgList .Query.IDs }})
{{ end }}
 )
 ORDER BY u.id asc
 LIMIT 500