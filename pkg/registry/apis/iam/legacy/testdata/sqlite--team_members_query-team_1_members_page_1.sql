SELECT
  tm.id as id,
  t.uid as team_uid,
  t.id as team_id,
  u.uid as user_uid,
  u.id as user_id,
  u.name,
  u.email,
  u.login,
  tm.external,
  tm.created,
  tm.updated,
  tm.permission
FROM "grafana"."team_member" tm
INNER JOIN "grafana"."team" t ON tm.team_id = t.id
INNER JOIN "grafana"."user" u ON tm.user_id  = u.id
WHERE
  t.uid = 'team-1'
  AND tm.org_id = 1
ORDER BY t.id ASC
LIMIT 1;
