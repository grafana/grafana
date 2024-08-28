SELECT id, uid, name, email, created, updated
  FROM `grafana`.`team`
 WHERE org_id = 0
   AND uid = 'abc'
 ORDER BY id asc
 LIMIT 1
