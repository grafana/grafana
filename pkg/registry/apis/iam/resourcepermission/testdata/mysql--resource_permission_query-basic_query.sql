SELECT 
  p.id, p.action, p.scope, p.created, p.updated,
  r.name as role_name,
  COALESCE(u.uid, t.uid, br.role) as subject_uid,
  CASE WHEN u.uid IS NOT NULL THEN 'user' 
       WHEN t.uid IS NOT NULL THEN 'team'
       ELSE 'builtin_role' END as subject_type,
  COALESCE(u.is_service_account, TRUE) as is_service_account
FROM `grafana`.`permission` p
INNER JOIN `grafana`.`role` r ON p.role_id = r.id
LEFT JOIN `grafana`.`user_role` ur ON r.id = ur.role_id AND ur.org_id = r.org_id
LEFT JOIN `grafana`.`user` u ON ur.user_id = u.id
LEFT JOIN `grafana`.`team_role` tr ON r.id = tr.role_id AND tr.org_id = r.org_id
LEFT JOIN `grafana`.`team` t ON tr.team_id = t.id
LEFT JOIN `grafana`.`builtin_role` br ON r.id = br.role_id
WHERE r.name LIKE 'managed:%'
AND (u.uid IS NOT NULL OR t.uid IS NOT NULL OR br.role IS NOT NULL)
ORDER BY p.id
