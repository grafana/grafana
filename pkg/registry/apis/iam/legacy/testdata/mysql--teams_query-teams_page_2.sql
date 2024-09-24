SELECT id, uid, name, email, created, updated
  FROM `grafana`.`team`
 WHERE org_id = 0
   AND id >= 2
 ORDER BY id asc
 LIMIT 1
