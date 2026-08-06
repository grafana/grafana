SELECT
  team_member.org_id,
  team_member.team_id,
  team_member.user_id,
  team_member.uid,
  user.email,
  user.name,
  user.login,
  user.uid AS user_uid,
  team_member.external,
  team_member.permission,
  user_auth.auth_module,
  team.uid AS team_uid
FROM `test_schema`.`team_member` AS team_member
INNER JOIN `test_schema`.`user` AS user ON team_member.user_id = user.id
INNER JOIN `test_schema`.`team` AS team ON team.id = team_member.team_id
LEFT JOIN `test_schema`.`user_auth` AS user_auth ON user_auth.id = (
  SELECT id
  FROM `test_schema`.`user_auth` AS user_auth
  WHERE user_auth.user_id = team_member.user_id
  ORDER BY user_auth.created DESC
  LIMIT 1
)
WHERE user.is_service_account = FALSE
AND user.id IN (42, 43)
AND team_member.org_id = 7
AND team_member.team_id = 11
AND team.uid = 'team-a'
AND team_member.user_id = 42
AND team_member.external = TRUE
ORDER BY user.login ASC, user.email ASC
