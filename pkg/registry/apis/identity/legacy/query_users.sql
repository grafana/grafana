SELECT o.org_id, u.id, u.uid, u.login, u.email, u.name,
  u.created, u.updated, u.is_service_account, u.is_disabled, u.is_admin
  FROM {{ .Ident .UserTable }} as u JOIN {{ .Ident .OrgUserTable }} as o ON u.id = o.user_id
 WHERE o.org_id = {{ .Arg .Query.OrgID }}
   AND u.is_service_account = {{ .Arg .Query.IsServiceAccount }}
{{ if .Query.UID }}
   AND uid = {{ .Arg .Query.UID }}
{{ end }}
{{ if .Query.ContinueID }}
   AND id > {{ .Arg .Query.ContinueID }}
{{ end }}
 ORDER BY u.id asc
 LIMIT {{ .Arg .Query.Limit }}