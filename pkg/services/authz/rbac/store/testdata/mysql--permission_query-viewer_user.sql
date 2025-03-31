SELECT p.kind, p.attribute, p.identifier, p.scope FROM `grafana`.`permission` as p
INNER JOIN (
  SELECT role_id FROM `grafana`.`builtin_role` as br WHERE (br.role = 'Viewer' AND (br.org_id = 1 OR br.org_id = 0))
  UNION ALL
  SELECT role_id FROM `grafana`.`user_role` as ur WHERE ur.user_id = 1 AND (ur.org_id = 1 OR ur.org_id = 0)
) as roles ON p.role_id = roles.role_id
WHERE
  p.action = 'folders:read'
