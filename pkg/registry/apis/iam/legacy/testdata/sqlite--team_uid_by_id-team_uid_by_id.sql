SELECT t.uid
FROM "grafana"."team" as t
WHERE t.org_id = 1
AND t.id = 42
LIMIT 1;
