SELECT o.org_id, u.id, u.uid, u.login, u.email, u.name, 
  u.created, u.updated, u.is_service_account, u.is_disabled, u.is_admin
  FROM "grafana.user" as u JOIN "grafana.org_user" as o ON u.id = o.user_id
 WHERE org_user.org_id = $1 
   AND u.is_service_account = $2
   AND uid = $3
 ORDER BY u.id asc
 LIMIT $4
