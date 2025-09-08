SELECT p.scope, MAX(p.id) AS id
FROM `grafana`.`permission` p
INNER JOIN `grafana`.`role` r ON p.role_id = r.id
WHERE r.name LIKE 'managed:%' 
    AND r.org_id = 3
    AND p.id > 5
GROUP BY p.scope
ORDER BY p.scope
LIMIT 100
