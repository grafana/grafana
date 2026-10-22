SELECT 1 FROM "grafana"."permission" as p
INNER JOIN (
  SELECT role_id FROM "grafana"."builtin_role" as br WHERE (br.role = 'Admin' AND (br.org_id = 1 OR br.org_id = 0))
    OR (br.role = 'Grafana Admin')
  UNION ALL
  SELECT role_id FROM "grafana"."user_role" as ur WHERE ur.user_id = 1 AND (ur.org_id = 1 OR ur.org_id = 0)
  UNION ALL
  SELECT role_id FROM "grafana"."team_role" as tr WHERE tr.team_id IN (1, 2) AND tr.org_id = 1
) as roles ON p.role_id = roles.role_id
WHERE
  p.action IN ('folders:edit', 'folders:admin', 'folders:create')
LIMIT 1
