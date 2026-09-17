SELECT team_member.team_id, team.uid
FROM "test_schema"."team_member" AS team_member
INNER JOIN "test_schema"."team" AS team ON team.id = team_member.team_id
WHERE team_member.user_id = 42
  AND team_member.org_id = 7
ORDER BY team_member.team_id ASC
