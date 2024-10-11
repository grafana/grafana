SELECT t.id as team_id, t.uid as team_uid, t.name as team_name, tm.permission
FROM "grafana"."user" u
INNER JOIN "grafana"."team_member" tm on u.id = tm.user_id
INNER JOIN "grafana"."team"t on tm.team_id = t.id
WHERE u.uid = 'user-1'
AND t.org_id = 1
ORDER BY t.id ASC
LIMIT 1;
