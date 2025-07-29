SELECT 
  p.id, p.action, p.scope, p.created, p.updated,
  r.name as role_name, r.uid as role_uid, r.org_id,
  ur.user_id, ur.org_id as user_org_id,
  u.uid as user_uid, u.login as user_login, u.name as user_name, u.email as user_email,
  COALESCE(u.is_service_account, 0) as is_service_account,
  tr.team_id, 
  t.uid as team_uid, t.name as team_name,
  br.org_id as builtin_org_id, br.role as builtin_role
FROM `grafana`.`permission` p
INNER JOIN `grafana`.`role` r ON p.role_id = r.id
LEFT JOIN user_role ur ON r.id = ur.role_id AND ur.org_id = r.org_id
LEFT JOIN `user` u ON ur.user_id = u.id
LEFT JOIN team_role tr ON r.id = tr.role_id AND tr.org_id = r.org_id  
LEFT JOIN team t ON tr.team_id = t.id
LEFT JOIN builtin_role br ON r.id = br.role_id AND br.org_id = r.org_id
WHERE (ur.user_id IS NOT NULL OR tr.team_id IS NOT NULL OR br.role IS NOT NULL)
ORDER BY p.id
LIMIT 15
OFFSET 5
