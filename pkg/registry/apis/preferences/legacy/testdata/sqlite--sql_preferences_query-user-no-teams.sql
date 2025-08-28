SELECT p.id, p.org_id,
  p.json_data,
  p.timezone,
  p.theme,
  p.week_start,
  p.home_dashboard_uid,
  u.uid as user_uid,
  t.uid as team_uid,
  p.created, p.updated
 FROM "grafana"."preferences" as p 
 LEFT JOIN "grafana"."user" as u ON p.user_id = u.id
 LEFT JOIN "grafana"."team" as t ON p.team_id = t.id
WHERE p.org_id = 1 
  AND (u.uid = 'uuu'
   OR p.user_id = 0
  )
ORDER BY p.user_id asc, p.team_id asc, p.org_id asc
