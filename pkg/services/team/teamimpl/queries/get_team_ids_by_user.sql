SELECT tm.team_id, team.uid
FROM {{ .Ident .TeamMemberTable }} as tm
JOIN {{ .Ident .TeamTable }} as team ON team.id = tm.team_id
WHERE tm.user_id = {{ .Arg .UserID }}
  AND tm.org_id = {{ .Arg .OrgID }}
ORDER BY tm.team_id asc
