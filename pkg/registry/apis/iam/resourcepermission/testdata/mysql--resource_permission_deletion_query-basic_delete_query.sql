DELETE FROM `grafana`.`permission` as p
WHERE p.scope = 'dash_123'
  AND p.role_id IN (
    SELECT r.id
    FROM `grafana`.`role` as r
    WHERE r.org_id = 3
      AND r.name LIKE 'managed:%'
  )
