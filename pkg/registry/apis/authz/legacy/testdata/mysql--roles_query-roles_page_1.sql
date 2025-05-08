SELECT r.version, r.org_id, r.id, r.uid, r.name, r.display_name, r.description, r.group, r.hidden, r.created_at, r.updated_at
  FROM `grafana`.`role` as r
 WHERE r.org_id = 0
 ORDER BY r.id asc
 LIMIT 5
