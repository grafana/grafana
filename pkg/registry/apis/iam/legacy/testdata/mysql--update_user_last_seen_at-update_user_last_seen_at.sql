-- name: update_user_last_seen_at
UPDATE `grafana`.`user`
SET last_seen_at = '2023-01-01 14:00:00'
WHERE uid = 'user-1'
