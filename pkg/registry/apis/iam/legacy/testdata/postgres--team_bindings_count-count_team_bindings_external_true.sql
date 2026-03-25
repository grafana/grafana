SELECT COUNT(*)
FROM "grafana"."team_member" tm
INNER JOIN "grafana"."team" t ON tm.team_id = t.id
INNER JOIN "grafana"."user" u ON tm.user_id  = u.id
WHERE
  tm.org_id = 1
    AND tm.external = TRUE
;
