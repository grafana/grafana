DELETE FROM `grafana`.`permission` p
WHERE p.scope = 'dash_123'
  AND p.role_id IN (
    SELECT r.id
    FROM `grafana`.`role` r
    WHERE r.name LIKE 'managed:%'
      AND r.org_id = 3
  )
