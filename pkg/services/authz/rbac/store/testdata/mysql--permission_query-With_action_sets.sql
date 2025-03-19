SELECT p.kind, p.attribute, p.identifier, p.scope FROM `grafana`.`permission` as p
LEFT JOIN `grafana`.`builtin_role` as br ON p.role_id = br.role_id 
    AND ((br.role = 'Viewer' AND (br.org_id = 1 OR br.org_id = 0))
    )
LEFT JOIN `grafana`.`user_role` as ur ON p.role_id = ur.role_id 
    AND ur.user_id = 1 AND (ur.org_id = 1 OR ur.org_id = 0)
WHERE
  p.action IN ('folders:edit', 'folders:admin', 'folders:create')
AND (br.role_id IS NOT NULL
  OR ur.role_id IS NOT NULL
);
