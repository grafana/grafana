-- Delete from user table (org_user will be handled separately to avoid locking)
DELETE FROM `grafana`.`user` 
WHERE uid = 'user-abc'
