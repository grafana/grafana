SELECT id, uid, name, email, created, updated
  FROM "team"
 WHERE org_id = $1
 ORDER BY id asc
 LIMIT $2
