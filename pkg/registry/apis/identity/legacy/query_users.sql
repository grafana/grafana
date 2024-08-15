SELECT org_user.org_id, u.id, u.uid, u.login, u.email, u.name, 
  u.created, u.updated, u.is_service_account, u.is_disabled, u.is_admin
  FROM {{ .Ident "user" }} as u JOIN org_user ON u.id = org_user.user_id
 WHERE org_user.org_id = {{ .Arg .Query.OrgID }} 
   AND u.is_service_account = {{ .Arg .Query.IsServiceAccount }}
{{ if .Query.UID }}
   AND uid = {{ .Arg .Query.UID }}
{{ end }}
{{ if .Query.ContinueID }}
   AND id > {{ .Arg .Query.ContinueID }}
{{ end }}
 ORDER BY u.id asc
 LIMIT {{ .Arg .Query.Limit }}