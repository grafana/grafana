SELECT 
  p.id, p.action, p.scope, p.created, p.updated,
  COALESCE(u.uid, t.uid) as subject_uid,
  CASE WHEN u.uid IS NOT NULL THEN 'user' ELSE 'team' END as subject_type,
  COALESCE(u.is_service_account, 0) as is_service_account
FROM "grafana"."permission" p
INNER JOIN "grafana"."role" r ON p.role_id = r.id
LEFT JOIN user_role ur ON r.id = ur.role_id AND ur.org_id = r.org_id
LEFT JOIN "user" u ON ur.user_id = u.id
LEFT JOIN team_role tr ON r.id = tr.role_id AND tr.org_id = r.org_id
LEFT JOIN team t ON tr.team_id = t.id
WHERE p.scope LIKE 'dashboards:%'
AND (u.uid IS NOT NULL OR t.uid IS NOT NULL)
ORDER BY p.id
LIMIT 15
OFFSET 5
