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
FROM "test_schema"."org_user" AS org_user
INNER JOIN "test_schema"."user" AS u ON org_user.user_id = u.id
WHERE org_user.org_id = 7
AND u.is_service_account = FALSE
AND 1 = 0
ORDER BY
u.login ASC, u.email ASC
