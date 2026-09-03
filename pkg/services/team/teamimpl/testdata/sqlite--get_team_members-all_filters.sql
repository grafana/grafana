SELECT
  team_member.org_id,
  team_member.team_id,
  team_member.user_id,
  team_member.uid,
  team_user.email,
  team_user.name,
  team_user.login,
  team_user.uid AS user_uid,
  team_member.external,
  team_member.permission,
  user_auth.auth_module,
  team.uid AS team_uid
FROM "test_schema"."team_member" AS team_member
INNER JOIN "test_schema"."user" AS team_user ON team_member.user_id = team_user.id
INNER JOIN "test_schema"."team" AS team ON team.id = team_member.team_id
LEFT JOIN "test_schema"."user_auth" AS user_auth ON user_auth.id = (
  SELECT id
  FROM "test_schema"."user_auth" AS user_auth
  WHERE user_auth.user_id = team_member.user_id
  ORDER BY user_auth.created DESC
  LIMIT 1
)
WHERE team_user.is_service_account = FALSE
AND team_user.id IN (42, 43)
AND team_member.org_id = 7
AND team_member.team_id = 11
AND team.uid = 'team-a'
AND team_member.user_id = 42
AND team_member.external = TRUE
ORDER BY team_user.login ASC, team_user.email ASC
