SELECT id, uid, name, email, created, updated
  FROM "grafana"."team"
 WHERE org_id = 0
 ORDER BY id asc
 LIMIT 5
