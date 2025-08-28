SELECT t.uid FROM "grafana"."team_member" as tm
  JOIN "grafana"."user" as u ON tm.user_id = u.id
  JOIN "grafana"."team" as t ON tm.team_id = t.id
 WHERE tm.org_id = 1 
   AND u.uid = 'uuu'
   AND tm.permission = 4
 ORDER BY t.id
