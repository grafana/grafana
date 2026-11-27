SELECT dashboard.id
FROM "grafana"."dashboard" as dashboard
WHERE dashboard.is_folder = FALSE
  AND dashboard.org_id = 1
  AND dashboard.id >= 42
ORDER BY dashboard.id ASC
LIMIT 25
