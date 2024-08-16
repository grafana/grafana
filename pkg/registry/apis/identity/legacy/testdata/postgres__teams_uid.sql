SELECT id, uid, name, email, created, updated
  FROM "grafana.team"
 WHERE org_id = $1
   AND uid = $2
 ORDER BY id asc
 LIMIT $3
