SELECT p.id, p.json_data,
  p.timezone,
  p.theme,
  p.week_start,
  p.home_dashboard_uid ,
  p.created, p.updated,
  u.uid as user_uid,
  t.uid as team_uid
 FROM {{ .Ident .PreferencesTable }} as p 
 LEFT JOIN {{ .Ident .UserTable }} as u ON p.user_id = u.id
 LEFT JOIN {{ .Ident .TeamTable }} as t ON p.team_id = t.id
WHERE p.org_id = {{ .Arg .OrgID }} 
{{ if .TeamUID }}
  AND t.uid = {{ .Arg .TeamUID }}
{{ else if .UserUID }}
  AND (u.uid = {{ .Arg .UserUID }}
  {{ if .UserTeams }}
    OR t.uid IN ({{ .ArgList .UserTeams }})
  {{ end }}
  )
{{ end }}
ORDER BY p.user_id asc, p.team_id asc; -- matches existing storage order
