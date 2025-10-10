SELECT s.query_uid, u.uid as user_uid 
  FROM {{ .Ident .QueryHistoryStarsTable }} as s 
  JOIN {{ .Ident .QueryHistoryTable }} as h ON s.query_uid = h.uid
  JOIN {{ .Ident .UserTable }} as u ON s.user_id  = u.id
 WHERE s.org_id = {{ .Arg .OrgID }} 
 {{ if .UserUID }}
   AND u.uid = {{ .Arg .UserUID }}
{{ end }}
 ORDER BY s.org_id asc, s.user_id asc, s.query_uid asc 
