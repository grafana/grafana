SELECT id, uid, name, email, external_uid, is_provisioned, created, updated
  FROM `grafana`.`team`
 WHERE org_id = 42
   AND LOWER(name) = LOWER('Operations')
 ORDER BY id asc
 LIMIT 2
