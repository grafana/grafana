SELECT
  u.id,
  u.uid,
  u.name,
  u.is_disabled,
  o.role,
  u.created,
  u.updated
  FROM "grafana"."user" as u JOIN "grafana"."org_user" as o ON u.id = o.user_id
 WHERE o.org_id = 1
   AND u.is_service_account
 ORDER BY u.id asc
 LIMIT 5
