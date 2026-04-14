SELECT
  t.id,
  t.name,
  t.is_revoked,
  t.last_used_at,
  t.expires,
  t.created,
  t.updated,
  u.uid,
  t.service_account_id
  FROM "grafana"."api_key" as t
  INNER JOIN "grafana"."user" as u ON t.service_account_id = u.id
WHERE t.org_id = 1
   AND u.is_service_account
   AND t.name = 'my-token'
   AND u.uid = 'sa-1'
LIMIT 1
