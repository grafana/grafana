SELECT 
  p.id, 
  p.action, 
  p.scope, 
  p.created, 
  p.updated,
  r.name as role_name, 
  r.uid as role_uid
FROM "grafana"."permission" p
INNER JOIN "grafana"."role" r ON p.role_id = r.id
WHERE p.scope LIKE 'dashboards:%'
ORDER BY p.id
LIMIT 10
