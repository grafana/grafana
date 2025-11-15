SELECT s.query_uid, u.uid as user_uid 
  FROM "grafana"."query_history_star" as s 
  JOIN "grafana"."query_history" as h ON s.query_uid = h.uid
  JOIN "grafana"."user" as u ON s.user_id  = u.id
 WHERE s.org_id = 1 
 ORDER BY s.org_id asc, s.user_id asc, s.query_uid asc 
