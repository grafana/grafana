SELECT
  u.id,
  u.uid,
  u.email,
  u.name,
  u.login,
  u.is_admin,
  u.is_disabled,
  u.last_seen_at,
  user_auth.auth_module,
  u.is_provisioned,
  u.created
FROM "test_schema"."user" AS u
LEFT JOIN "test_schema"."user_auth" AS user_auth ON user_auth.id = (
  SELECT id
  FROM "test_schema"."user_auth" AS user_auth
  WHERE user_auth.user_id = u.id
  ORDER BY user_auth.created DESC
  LIMIT 1
)
INNER JOIN "test_schema"."user_stats" AS "user_stats" ON user_stats.user_id = u.id
WHERE u.is_service_account = FALSE
AND u.org_id = 7
AND u.id IN (11, 12)
AND (
    u.email ILIKE '%ops%'
    OR u.name ILIKE '%ops%'
    OR u.login ILIKE '%ops%'
  )
AND u.is_disabled = TRUE
AND user_auth.auth_module = 'oauth'
AND "user_stats"."billing_role" IN ('admin', 'editor')
AND is_admin = TRUE
ORDER BY u.login DESC, u.email ASC
LIMIT 25 OFFSET 50
