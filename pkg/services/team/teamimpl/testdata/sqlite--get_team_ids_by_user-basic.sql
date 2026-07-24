SELECT tm.team_id, team.uid
FROM "test_schema"."team_member" as tm
JOIN "test_schema"."team" as team ON team.id = tm.team_id
WHERE tm.user_id = 1
  AND tm.org_id = 2
ORDER BY tm.team_id asc
