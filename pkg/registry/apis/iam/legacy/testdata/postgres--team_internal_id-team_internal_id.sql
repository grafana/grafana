SELECT t.id
FROM "grafana"."team" as t
WHERE t.org_id = 1
AND t.uid = 'team-1'
LIMIT 1;
