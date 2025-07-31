SELECT o.org_id, u.id, u.uid, u.login, u.email, u.name, 
  u.created, u.updated, u.is_service_account, u.is_disabled, u.is_admin,
  u.email_verified, u.is_provisioned, u.last_seen_at
  FROM "grafana"."user" as u JOIN "grafana"."org_user" as o ON u.id = o.user_id
 WHERE o.org_id = 2 AND ( 1=2
   OR uid IN ('a', 'b')
   OR u.id IN (1, 2)
 )
 ORDER BY u.id asc
 LIMIT 500
