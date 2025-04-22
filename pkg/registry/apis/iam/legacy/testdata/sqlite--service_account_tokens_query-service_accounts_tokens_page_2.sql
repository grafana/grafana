SELECT
  t.id,
  t.name,
  t.is_revoked,
  t.last_used_at,
  t.expires,
  t.created,
  t.updated
  FROM "grafana"."api_key" as t
  INNER JOIN "grafana"."user" as u ON t.service_account_id = u.id
  INNER JOIN "grafana"."org_user" as o ON u.id = o.user_id
WHERE o.org_id = 1
   AND u.is_service_account
   AND u.uid = ''
   AND t.id >= 2
 ORDER BY t.id asc
 LIMIT 1
