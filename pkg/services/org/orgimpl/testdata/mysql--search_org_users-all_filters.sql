SELECT
  org_user.org_id,
  org_user.user_id,
  u.email,
  u.uid,
  u.name,
  u.login,
  org_user.role,
  u.last_seen_at,
  u.created,
  u.updated,
  u.is_disabled,
  u.is_provisioned
FROM `test_schema`.`org_user` AS org_user
INNER JOIN `test_schema`.`user` AS u ON org_user.user_id = u.id
WHERE org_user.org_id = 7
AND org_user.user_id = 42
AND u.is_service_account = FALSE
AND org_user.user_id IN (11, 12)
AND u.login NOT IN ('hidden-user', 'another-hidden-user')
AND (
    u.email LIKE '%ops%'
    OR u.name LIKE '%ops%'
    OR u.login LIKE '%ops%'
  )
ORDER BY
u.login DESC, u.email ASC
LIMIT 25 OFFSET 50
