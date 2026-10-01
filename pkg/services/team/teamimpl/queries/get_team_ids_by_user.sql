SELECT team_member.team_id, team.uid
FROM {{ .Ident .TeamMemberTable }} AS team_member
INNER JOIN {{ .Ident .TeamTable }} AS team ON team.id = team_member.team_id
WHERE team_member.user_id = {{ .Arg .UserID }}
  AND team_member.org_id = {{ .Arg .OrgID }}
ORDER BY team_member.team_id ASC
