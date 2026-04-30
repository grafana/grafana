-- name: update_user_last_seen_at
UPDATE `grafana`.`user`
SET last_seen_at = '2023-06-15 10:30:00'
WHERE uid = 'user-1'
