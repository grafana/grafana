SELECT o.org_id, u.id, u.uid, u.login, u.email, u.name, 
  u.created, u.updated, u.is_service_account, u.is_disabled, u.is_admin
  FROM "grafana.user" as u JOIN "grafana.org_user" as o ON u.id = o.user_id
 WHERE org_user.org_id = ? 
   AND u.is_service_account = ?
   AND uid = ?
 ORDER BY u.id asc
 LIMIT ?
