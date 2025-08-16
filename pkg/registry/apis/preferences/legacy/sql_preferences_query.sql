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
ORDER BY p.id asc;
