SELECT id, uid, name, email, created, updated
  FROM "grafana.team"
 WHERE org_id = ?
   AND id > ?
 ORDER BY id asc
 LIMIT ?
