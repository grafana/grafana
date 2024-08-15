SELECT id, uid, name, email, created, updated
  FROM "team"
 WHERE org_id = ?
 ORDER BY id asc
 LIMIT ?
