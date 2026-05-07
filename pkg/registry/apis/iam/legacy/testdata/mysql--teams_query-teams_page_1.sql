SELECT id, uid, name, email, external_uid, is_provisioned, created, updated
  FROM `grafana`.`team`
 WHERE org_id = 0
 ORDER BY id asc
 LIMIT 5
