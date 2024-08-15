SELECT id, uid, name, email, created, updated
  FROM "team"
 WHERE org_id = $1
   AND id > $2
 ORDER BY id asc
 LIMIT $3
