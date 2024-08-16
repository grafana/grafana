SELECT org_user.org_id, u.id, u.uid, u.login, u.email, u.name, 
  u.created, u.updated, u.is_service_account, u.is_disabled, u.is_admin
  FROM `user` as u JOIN org_user ON u.id = org_user.user_id
 WHERE org_user.org_id = 0 
   AND u.is_service_account = FALSE
 ORDER BY u.id asc
 LIMIT 5
