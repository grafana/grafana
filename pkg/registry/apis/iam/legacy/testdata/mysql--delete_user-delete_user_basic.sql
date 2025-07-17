-- Delete from user table (org_user will be handled separately to avoid locking)
DELETE FROM `grafana`.`user` 
WHERE uid = 'user-1' 
  AND org_id = 1
