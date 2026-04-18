SELECT s.org_id, u.uid as user_uid, s.dashboard_uid, s.updated 
  FROM {{ .Ident .StarTable }} as s 
  JOIN {{ .Ident .UserTable }} as u ON s.user_id = u.id
{{ if ge .OrgID 1 }}
WHERE s.org_id = {{ .Arg .OrgID }} 
{{ if .UserUID }}
  AND u.uid = {{ .Arg .UserUID }}
{{ end }}{{ end }}
ORDER BY 
  s.org_id asc, s.user_id asc, s.updated asc 
