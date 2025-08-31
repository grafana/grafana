SELECT DISTINCT
  p.scope,
  MIN(p.created) as created
FROM "grafana"."permission" p
INNER JOIN "grafana"."role" r ON p.role_id = r.id
LEFT JOIN "grafana"."user_role" ur ON r.id = ur.role_id AND ur.org_id = r.org_id
LEFT JOIN "grafana"."user" u ON ur.user_id = u.id
LEFT JOIN "grafana"."team_role" tr ON r.id = tr.role_id AND tr.org_id = r.org_id
LEFT JOIN "grafana"."team" t ON tr.team_id = t.id
LEFT JOIN "grafana"."builtin_role" br ON r.id = br.role_id
WHERE r.name LIKE 'managed:%'
AND (u.uid IS NOT NULL OR t.uid IS NOT NULL OR br.role IS NOT NULL)
AND p.scope IS NOT NULL 
AND p.scope != ''
AND (p.scope LIKE 'dashboards:uid:%' OR p.scope LIKE 'folders:uid:%')
GROUP BY p.scope
ORDER BY p.scope
LIMIT 10
