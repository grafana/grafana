SELECT p.action, p.kind, p.attribute, p.identifier, p.scope FROM `grafana`.`permission` as p
WHERE p.action = 'folders:read' AND p.role_id IN (
  SELECT role_id FROM `grafana`.`builtin_role` as br WHERE (br.role = 'Viewer' AND (br.org_id = 1 OR br.org_id = 0))
)
