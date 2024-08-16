SELECT id, uid, name, email, created, updated
  FROM "team"
 WHERE org_id = 0
   AND uid = 'abc'
 ORDER BY id asc
 LIMIT 0
