SELECT p.scope
FROM `grafana`.`permission` AS p
INNER JOIN `grafana`.`role` AS r ON p.role_id = r.id
WHERE r.name LIKE 'managed:%' 
    AND r.org_id = 3
    AND (  p.scope LIKE 'folders:uid:%' OR  p.scope LIKE 'dashboards:uid:%' )
GROUP BY p.scope
ORDER BY p.scope
LIMIT 100
OFFSET 5
