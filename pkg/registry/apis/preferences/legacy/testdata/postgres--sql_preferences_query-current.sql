SELECT p.id, p.json_data,
  p.timezone,
  p.theme,
  p.week_start,
  p.home_dashboard_uid ,
  p.created, p.updated,
  u.uid as user_uid,
  t.uid as team_uid
 FROM "grafana"."preferences" as p 
 LEFT JOIN "grafana"."user" as u ON p.user_id = u.id
 LEFT JOIN "grafana"."team" as t ON p.team_id = t.id
WHERE p.org_id = 1 
  AND (u.uid = 'uuu'
    OR t.uid IN ('a', 'b', 'c')
  )
ORDER BY p.user_id asc, p.team_id asc; -- matches existing storage order
