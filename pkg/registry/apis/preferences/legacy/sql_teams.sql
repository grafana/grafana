SELECT t.uid FROM {{ .Ident .TeamMemberTable }} as tm
  JOIN {{ .Ident .UserTable }} as u ON tm.user_id = u.id
  JOIN {{ .Ident .TeamTable }} as t ON tm.team_id = t.id
 WHERE tm.org_id = {{ .Arg .OrgID }} 
   AND u.uid = {{ .Arg .UserUID }}
{{ if .IsAdmin }}
   AND tm.permission = 4
{{ end }}
 ORDER BY t.id